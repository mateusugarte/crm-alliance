import type { PoolClient } from 'pg'
import { centralTransaction } from '@/lib/central-do-dia/db'

export const CHECKIN_RESPOSTAS = ['ligou', 'nao_ligou'] as const
export type CheckinResposta = (typeof CHECKIN_RESPOSTAS)[number]

// Detalhe opcional quando o corretor conta como foi a ligacao.
export const CHECKIN_DETALHES = ['atendeu', 'nao_atendeu', 'caixa_postal', 'numero_errado'] as const
export type CheckinDetalhe = (typeof CHECKIN_DETALHES)[number]

const DETALHE_LABEL: Record<CheckinDetalhe, string> = {
  atendeu: 'o lead atendeu',
  nao_atendeu: 'o lead nao atendeu',
  caixa_postal: 'caiu na caixa postal',
  numero_errado: 'numero errado',
}

interface Profile {
  id: string
  full_name: string
  role: 'adm' | 'corretor'
}

function firstName(name: string) {
  return (name.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Corretor pelo primeiro nome; senao o responsavel do lead; senao o ADM. */
export function resolveUser(profiles: Profile[], corretorNome: string, assignedTo: string | null) {
  const nome = firstName(corretorNome)
  const byName = nome ? profiles.filter((profile) => firstName(profile.full_name) === nome) : []
  if (byName.length === 1) return byName[0]
  return profiles.find((profile) => profile.id === assignedTo)
    ?? profiles.find((profile) => profile.role === 'adm')
    ?? null
}

async function loadProfiles(client: PoolClient) {
  const { rows } = await client.query<Profile>('select id, full_name, role from user_profiles order by created_at')
  return rows
}

export function checkinComment(input: {
  data: string
  respondente: string
  resposta: CheckinResposta
  detalhe?: CheckinDetalhe | null
}) {
  const quem = input.respondente.trim() || 'Corretor'
  const oQue = input.resposta === 'ligou'
    ? `LIGOU para este lead${input.detalhe ? ` (${DETALHE_LABEL[input.detalhe]})` : ''}`
    : 'NAO LIGOU para este lead'
  return `Check-in de ligacoes (${input.data}): ${quem} respondeu no grupo que ${oQue}.`
}

function hojeSaoPaulo() {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date())
}

/**
 * Registra no CRM a resposta de um corretor sobre um lead do check-in.
 * Sempre grava um comentario no lead com o nome de quem respondeu no grupo.
 * Quando ligou, tambem registra a ligacao pela regra transacional da Central
 * do Dia (registrar_ligacao_lead_v1) executando como o usuario do corretor:
 * auth.uid() le o claim sub da requisicao, que so vale nesta transacao.
 * A mesma resposta repetida nao duplica nada.
 */
export async function registrarCheckin(input: {
  leadId: string
  resposta: CheckinResposta
  detalhe?: CheckinDetalhe | null
  respondente: string
  mensagem: string
}) {
  return centralTransaction(async (client) => {
    await client.query('select pg_advisory_xact_lock(hashtextextended($1, 401))', [input.leadId])

    const { rows: leads } = await client.query<{
      id: string
      name: string
      assigned_to: string | null
      qualificado_em: string | null
    }>('select id, name, assigned_to, qualificado_em from leads where id=$1', [input.leadId])
    const lead = leads[0]
    if (!lead) return { status: 'lead_nao_encontrado' as const }

    const user = resolveUser(await loadProfiles(client), input.respondente, lead.assigned_to)
    if (!user) throw new Error('Nenhum usuario para atribuir o check-in')

    const comentario = checkinComment({ data: hojeSaoPaulo(), ...input })
    const { rowCount: repetido } = await client.query(
      `select 1 from lead_comments where lead_id=$1 and content=$2 and created_at > now() - interval '20 hours'`,
      [lead.id, comentario],
    )
    if (repetido) return { status: 'ja_registrado' as const, lead: lead.name }

    await client.query(
      'insert into lead_comments (lead_id,user_id,user_name,content) values ($1,$2,$3,$4)',
      [lead.id, user.id, user.full_name, comentario],
    )

    if (input.resposta === 'nao_ligou') {
      return { status: 'registrado' as const, lead: lead.name, ligacaoRegistrada: false }
    }

    const { rowCount: jaLigado } = await client.query(
      `select 1 from ligacoes
        where lead_id=$1 and excluida_em is null
          and registrada_em >= coalesce($2::timestamptz, now() - interval '1 day')`,
      [lead.id, lead.qualificado_em],
    )
    if (jaLigado) return { status: 'registrado' as const, lead: lead.name, ligacaoRegistrada: false }

    await client.query(
      `select set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claims', $2, true)`,
      [user.id, JSON.stringify({ sub: user.id, role: 'authenticated' })],
    )
    await client.query(
      'select registrar_ligacao_lead_v1($1, $2::ligacao_desfecho, $3)',
      [
        lead.id,
        input.detalhe ?? 'atendeu',
        `Check-in no grupo: ${input.respondente.trim() || 'corretor'} informou que ligou. Resposta: ${input.mensagem.slice(0, 300)}`,
      ],
    )
    await client.query(
      `select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true)`,
    )

    return { status: 'registrado' as const, lead: lead.name, ligacaoRegistrada: true }
  })
}
