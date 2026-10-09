import type { PoolClient } from 'pg'
import { centralTransaction } from '@/lib/central-do-dia/db'

export const CHECKIN_RESULTADOS = ['atendeu', 'nao_atendeu', 'caixa_postal', 'numero_errado', 'nao_ligou'] as const
export type CheckinResultado = (typeof CHECKIN_RESULTADOS)[number]

interface Profile {
  id: string
  full_name: string
  role: 'adm' | 'corretor'
}

function firstName(name: string) {
  return (name.trim().split(/\s+/)[0] ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
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

/**
 * Registra no CRM o que o corretor informou sobre um lead do check-in.
 * "Ligou" passa pela mesma regra transacional da Central do Dia
 * (registrar_ligacao_lead_v1) executando como o corretor: auth.uid() le o
 * claim sub da requisicao, entao ele so vale dentro desta transacao.
 * "Nao ligou" vira um comentario no lead. Repeticoes nao duplicam registro.
 */
export async function registrarCheckin(input: {
  leadId: string
  resultado: CheckinResultado
  corretorNome: string
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

    const user = resolveUser(await loadProfiles(client), input.corretorNome, lead.assigned_to)
    if (!user) throw new Error('Nenhum usuario para atribuir o check-in')

    if (input.resultado === 'nao_ligou') {
      const { rowCount } = await client.query(
        `select 1 from lead_comments
          where lead_id=$1 and content like 'Check-in de ligacoes%NAO ligou%'
            and created_at > now() - interval '20 hours'`,
        [lead.id],
      )
      if (rowCount) return { status: 'ja_registrado' as const, lead: lead.name }

      await client.query(
        `insert into lead_comments (lead_id,user_id,user_name,content)
         values ($1,$2,$3,'Check-in de ligacoes (' || to_char(now() at time zone 'America/Sao_Paulo','DD/MM')
           || '): ' || $4 || ' informou que NAO ligou para este lead.')`,
        [lead.id, user.id, user.full_name, input.corretorNome || user.full_name],
      )
      return { status: 'registrado' as const, lead: lead.name, corretor: user.full_name }
    }

    const { rowCount: jaLigado } = await client.query(
      `select 1 from ligacoes
        where lead_id=$1 and excluida_em is null
          and registrada_em >= coalesce($2::timestamptz, now() - interval '1 day')`,
      [lead.id, lead.qualificado_em],
    )
    if (jaLigado) return { status: 'ja_registrado' as const, lead: lead.name }

    await client.query(
      `select set_config('request.jwt.claim.sub', $1, true),
              set_config('request.jwt.claims', $2, true)`,
      [user.id, JSON.stringify({ sub: user.id, role: 'authenticated' })],
    )
    const { rows } = await client.query<{ result: { call?: { id?: string } } }>(
      'select registrar_ligacao_lead_v1($1, $2::ligacao_desfecho, $3) result',
      [
        lead.id,
        input.resultado,
        `Registrado pelo check-in de ligacoes no WhatsApp. Resposta do corretor: ${input.mensagem.slice(0, 300)}`,
      ],
    )
    await client.query(
      `select set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '', true)`,
    )

    return {
      status: 'registrado' as const,
      lead: lead.name,
      corretor: user.full_name,
      ligacaoId: rows[0]?.result?.call?.id ?? null,
    }
  })
}
