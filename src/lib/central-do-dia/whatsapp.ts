import { randomUUID } from 'crypto'
import { sendTextMessage } from '@/lib/whatsapp/send'
import { centralQuery } from './db'

const DEFAULT_CRM_URL = 'https://crm-alliance.vercel.app'
const MAX_DELIVERY_ATTEMPTS = 8

interface DailyContactRow {
  tarefa_id: string
  name: string
  tentativa_num: number
  lead_score: number | null
  no_contact_days: number
}

export function attemptLabel(attempt: number) {
  return attempt <= 1 ? 'nunca ligado' : `${attempt}ª tentativa`
}

export function scoreLabel(score: number | null) {
  return Math.max(0, Math.min(10, (score ?? 0) / 10)).toFixed(1).replace('.', ',')
}

export function formatDailyFollowupMessage(rows: DailyContactRow[], crmUrl: string) {
  return [
    '*FOLLOW UP DO DIA - LIGAÇÕES*',
    '',
    `${rows.length} ${rows.length === 1 ? 'contato' : 'contatos'} para follow up hoje:`,
    '',
    ...rows.map((item, index) => (
      `${index + 1}. ${item.name} - ${attemptLabel(item.tentativa_num)} - score ${scoreLabel(item.lead_score)} - ${item.no_contact_days} d sem contato`
    )),
    '',
    'Abra o CRM para ver o contexto e registrar a ligação.',
    `${crmUrl}/dashboard`,
  ].join('\n')
}

export async function queueDailyFollowupMessage(date: string) {
  const { rows: settings } = await centralQuery<{ group_jid: string | null; crm_url: string | null }>(
    `select valor->>'grupo_whatsapp' group_jid, valor->>'crm_base_url' crm_url
       from configuracoes_sistema where chave='central_do_dia'`,
  )
  const groupJid = settings[0]?.group_jid?.trim()
  const crmUrl = settings[0]?.crm_url || DEFAULT_CRM_URL

  if (!groupJid) {
    throw new Error('Grupo do WhatsApp nao configurado em central_do_dia')
  }

  const { rows } = await centralQuery<DailyContactRow>(
    `select t.id tarefa_id, l.name, t.tentativa_num, l.lead_score,
            greatest(0, (timezone('America/Sao_Paulo', now())::date
              - timezone('America/Sao_Paulo', coalesce(
                  case when t.origem='qualificacao' then l.qualificado_em end,
                  l.ultimo_contato_em,
                  (select max(i.created_at) from interactions i where i.lead_id=l.id),
                  l.qualificado_em,
                  l.created_at
                ))::date))::int no_contact_days
       from fila_diaria fd
       join tarefas t on t.id=fd.tarefa_id
       join leads l on l.id=t.lead_id
      where fd.data=$1::date and t.status in ('pendente','vencida')
      order by fd.posicao`,
    [date],
  )

  if (!rows.length) return { queued: false, contacts: 0 }

  const body = formatDailyFollowupMessage(rows, crmUrl)

  const { rows: upserted } = await centralQuery<{ id: string }>(
    `insert into mensagens_saida (destino,destino_tipo,corpo,contexto)
     values ($1,'grupo',$2,jsonb_build_object(
       'tipo','fila_diaria_grupo','data',$3::text,
       'idempotency_key','fila-diaria-grupo:'||$3::text
     ))
     on conflict ((contexto->>'idempotency_key')) where contexto ? 'idempotency_key'
     do update set
       destino=excluded.destino,
       corpo=excluded.corpo,
       erro=null,
       proxima_tentativa_em=least(mensagens_saida.proxima_tentativa_em,now())
     where mensagens_saida.enviada_em is null
       and mensagens_saida.processando_em is null
     returning id`,
    [groupJid, body, date],
  )
  return { queued: upserted.length > 0, contacts: rows.length, messageId: upserted[0]?.id ?? null }
}

export async function deliverPendingGroupMessages(limit = 10, messageId?: string) {
  const worker = `crm-cron:${randomUUID()}`
  const { rows: messages } = await centralQuery<{
    id: string
    destino: string
    corpo: string
  }>(
    `with picked as (
       select id from mensagens_saida
        where enviada_em is null and destino_tipo='grupo'
          and (processando_em is null or processando_em < now()-interval '5 minutes')
          and (proxima_tentativa_em is null or proxima_tentativa_em<=now())
          and tentativas < $3
          and ($4::uuid is null or id=$4::uuid)
        order by criada_em
        for update skip locked
        limit $1
     )
     update mensagens_saida m
        set processando_em=now(), processando_por=$2, tentativas=tentativas+1
       from picked p where m.id=p.id
     returning m.id,m.destino,m.corpo`,
    [limit, worker, MAX_DELIVERY_ATTEMPTS, messageId ?? null],
  )
  if (!messages.length) return { sent: 0, failed: 0 }

  const { rows: instances } = await centralQuery<{ instance_id: string }>(
    `select instance_id from wa_instances
      where status='connected'
      order by connected_at desc nulls last limit 1`,
  )
  const instanceToken = instances[0]?.instance_id
  if (!instanceToken) {
    await centralQuery(
      `update mensagens_saida
          set erro='Nenhuma instancia do WhatsApp conectada',ultimo_erro_em=now(),
              proxima_tentativa_em=now()+interval '5 minutes',processando_em=null,processando_por=null
        where processando_por=$1`,
      [worker],
    )
    return { sent: 0, failed: messages.length }
  }

  let sent = 0
  let failed = 0
  for (const message of messages) {
    try {
      const result = await sendTextMessage(instanceToken, message.destino, message.corpo)
      if (result.success) {
        await centralQuery(
          `update mensagens_saida
              set enviada_em=now(),provider_message_id=$3,erro=null,
                  processando_em=null,processando_por=null
            where id=$1 and processando_por=$2`,
          [message.id, worker, result.wa_message_id ?? null],
        )
        sent += 1
      } else {
        await centralQuery(
          `update mensagens_saida
              set erro=$3,ultimo_erro_em=now(),
                  proxima_tentativa_em=now()+make_interval(mins=>least(60,power(2,tentativas)::integer)),
                  processando_em=null,processando_por=null
            where id=$1 and processando_por=$2`,
          [message.id, worker, result.error ?? 'Falha ao enviar mensagem'],
        )
        failed += 1
      }
    } catch (error) {
      await centralQuery(
        `update mensagens_saida
            set erro=$3,ultimo_erro_em=now(),
                proxima_tentativa_em=now()+make_interval(mins=>least(60,power(2,tentativas)::integer)),
                processando_em=null,processando_por=null
          where id=$1 and processando_por=$2`,
        [message.id, worker, error instanceof Error ? error.message : 'Falha ao enviar mensagem'],
      )
      failed += 1
    }
  }

  return { sent, failed }
}
