import { centralQuery, centralTransaction } from '@/lib/central-do-dia/db'
import { localDate } from '@/lib/central-do-dia/cron'
import { deliverPendingGroupMessages } from '@/lib/central-do-dia/whatsapp'
import { activeList, loadCheckinState, saveCheckinState, type CheckinLead } from './config'
import { runCorretorCheckinAgent, type CheckinAgentResult } from './corretor-agent'

const UAZAPI_URL = process.env.UAZAPI_BASE_URL || 'https://getmore.uazapi.com'
const FETCH_LIMIT = 50

function formatTelefone(phone: string) {
  const digits = phone.split('@')[0].replace(/\D/g, '')
  return digits.startsWith('55') && digits.length >= 12 ? `(${digits.slice(2, 4)}) ${digits.slice(4)}` : digits
}

export function formatCheckinQuestion(date: string, lista: CheckinLead[]) {
  const [, month, day] = date.split('-')
  return [
    `*CHECK-IN DE LIGAÇÕES · ${day}/${month}*`,
    '',
    lista.length === 1
      ? '1 lead foi qualificado e ainda não tem ligação registrada no CRM. Quem ligou?'
      : `${lista.length} leads foram qualificados e ainda não têm ligação registrada no CRM. Quem ligou?`,
    '',
    ...lista.map((lead) => `${lead.numero}. ${lead.nome} · ${lead.telefone}`),
    '',
    'Corretores, respondam aqui com o número e o resultado, por exemplo:',
    '1 atendeu',
    '2 não atendeu',
    '3 não liguei',
    '',
    'Também vale: caixa postal, número errado. As respostas são registradas direto no CRM.',
  ].join('\n')
}

async function connectedInstanceToken() {
  const { rows } = await centralQuery<{ instance_id: string }>(
    `select instance_id from wa_instances where status='connected'
      order by connected_at desc nulls last limit 1`,
  )
  const token = rows[0]?.instance_id
  if (!token) throw new Error('Nenhuma instancia do WhatsApp conectada')
  return token
}

/**
 * Disparo das 17h: lista os leads qualificados nas ultimas 24h que ainda nao
 * tem ligacao registrada e pergunta no grupo. Sem leads, nao envia nada.
 * Rodar de novo no mesmo dia nao repete a pergunta.
 */
export async function abrirCheckin(grupoJid: string) {
  const date = localDate()
  const state = await loadCheckinState()
  if (state.data === date && state.grupo_whatsapp === grupoJid && state.enviado_em) {
    return { enviado: false, motivo: 'ja_enviado_hoje' as const, data: date, leads: state.lista.length }
  }

  const { rows } = await centralQuery<{ id: string; name: string; phone: string }>(
    `select id, name, phone from leads
      where qualificado_em > now() - interval '24 hours'
        and stage <> 'fornecedores'
        and (primeira_ligacao_em is null or primeira_ligacao_em < qualificado_em)
      order by qualificado_em, id`,
  )
  if (!rows.length) return { enviado: false, motivo: 'sem_leads' as const, data: date, leads: 0 }

  const lista: CheckinLead[] = rows.map((lead, index) => ({
    numero: index + 1,
    lead_id: lead.id,
    nome: lead.name,
    telefone: formatTelefone(lead.phone),
  }))

  const { rows: queued } = await centralQuery<{ id: string }>(
    `insert into mensagens_saida (destino,destino_tipo,corpo,contexto)
     values ($1,'grupo',$2,jsonb_build_object('tipo','checkin_ligacoes','idempotency_key',$3::text))
     on conflict ((contexto->>'idempotency_key')) where contexto ? 'idempotency_key'
     do nothing
     returning id`,
    [grupoJid, formatCheckinQuestion(date, lista), `checkin-ligacoes:${grupoJid}:${date}`],
  )

  const enviadoEm = new Date()
  // So mensagens do grupo depois da pergunta sao lidas como resposta.
  await saveCheckinState({
    grupo_whatsapp: grupoJid,
    data: date,
    lista,
    enviado_em: enviadoEm.toISOString(),
    cursor_ms: enviadoEm.getTime(),
  })

  const delivery = queued[0] ? await deliverPendingGroupMessages(1, queued[0].id) : { sent: 0, failed: 0 }
  return { enviado: delivery.sent > 0, motivo: 'pergunta_enviada' as const, data: date, leads: lista.length, ...delivery }
}

export interface GroupMessage {
  id: string
  timestampMs: number
  senderName: string
  text: string
}

/** Normaliza a resposta do /message/find da UazAPI. */
export function parseGroupMessages(payload: unknown, grupoJid: string): GroupMessage[] {
  const raw = payload as { messages?: unknown[] } | unknown[] | null
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.messages) ? raw.messages : []

  return list.flatMap((item) => {
    const msg = item as Record<string, unknown>
    const chatId = String(msg.chatid ?? msg.chatId ?? '')
    if (chatId && chatId !== grupoJid) return []
    if (msg.fromMe === true || msg.wasSentByApi === true) return []

    const content = msg.content as { text?: unknown } | string | undefined
    const text = String(msg.text ?? (typeof content === 'string' ? content : content?.text) ?? '').trim()
    const ts = Number(msg.messageTimestamp ?? msg.timestamp ?? 0)
    if (!text || !ts) return []

    return [{
      id: String(msg.messageid ?? msg.id ?? ''),
      timestampMs: ts < 1e12 ? ts * 1000 : ts,
      senderName: String(msg.senderName ?? msg.pushName ?? '').trim(),
      text: text.slice(0, 2_000),
    }]
  }).sort((a, b) => a.timestampMs - b.timestampMs)
}

async function fetchGroupMessages(token: string, grupoJid: string) {
  const res = await fetch(`${UAZAPI_URL}/message/find`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', token },
    body: JSON.stringify({ chatid: grupoJid, limit: FETCH_LIMIT }),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    throw new Error(`UazAPI /message/find ${res.status}: ${(await res.text()).slice(0, 500)}`)
  }
  return parseGroupMessages(await res.json(), grupoJid)
}

/**
 * Le as mensagens novas do grupo desde a ultima leitura e passa cada uma para
 * o agente de check-in, que registra no CRM e nunca responde.
 */
export async function coletarRespostas() {
  return centralTransaction(async (client) => {
    // Duas coletas simultaneas nao processam a mesma mensagem.
    const { rows: lock } = await client.query<{ ok: boolean }>(
      `select pg_try_advisory_xact_lock(hashtextextended('checkin_ligacoes_coleta', 0)) ok`,
    )
    if (!lock[0]?.ok) return { processadas: 0, motivo: 'coleta_em_andamento' as const }

    const state = await loadCheckinState()
    const lista = activeList(state)
    if (!state.grupo_whatsapp || !lista.length) return { processadas: 0, motivo: 'sem_lista_ativa' as const }

    const cursor = state.cursor_ms ?? 0
    const novas = (await fetchGroupMessages(await connectedInstanceToken(), state.grupo_whatsapp))
      .filter((msg) => msg.timestampMs > cursor)

    const registros: (CheckinAgentResult & { corretor: string })[] = []
    let ultimo = cursor
    for (const msg of novas) {
      const results = await runCorretorCheckinAgent({ corretorNome: msg.senderName, lista, message: msg.text })
        .catch((error) => {
          console.error('[call-checkin] agente falhou na mensagem', msg.id, error instanceof Error ? error.message : error)
          return []
        })
      registros.push(...results.map((result) => ({ ...result, corretor: msg.senderName })))
      ultimo = msg.timestampMs
      await saveCheckinState({ ...state, cursor_ms: ultimo })
    }

    return { processadas: novas.length, registros }
  })
}
