import { centralQuery } from '@/lib/central-do-dia/db'

/**
 * Estado do check-in diario de ligacoes em configuracoes_sistema
 * (chave 'checkin_ligacoes'): a lista numerada enviada no grupo e ate onde as
 * mensagens do grupo ja foram lidas.
 */
export interface CheckinLead {
  numero: number
  lead_id: string
  nome: string
  telefone: string
}

export interface CheckinState {
  grupo_whatsapp: string | null
  data: string | null
  lista: CheckinLead[]
  enviado_em: string | null
  // messageTimestamp (ms) da ultima mensagem do grupo ja processada.
  cursor_ms: number | null
}

const CHAVE = 'checkin_ligacoes'
const LISTA_VALIDA_HORAS = 72

export async function loadCheckinState(): Promise<CheckinState> {
  const { rows } = await centralQuery<{ valor: Partial<CheckinState> | null }>(
    'select valor from configuracoes_sistema where chave=$1',
    [CHAVE],
  )
  const valor = rows[0]?.valor ?? {}
  return {
    grupo_whatsapp: valor.grupo_whatsapp ?? null,
    data: valor.data ?? null,
    lista: Array.isArray(valor.lista) ? valor.lista : [],
    enviado_em: valor.enviado_em ?? null,
    cursor_ms: typeof valor.cursor_ms === 'number' ? valor.cursor_ms : null,
  }
}

export async function saveCheckinState(state: CheckinState) {
  await centralQuery(
    `insert into configuracoes_sistema (chave, valor) values ($1, $2::jsonb)
     on conflict (chave) do update set valor=excluded.valor, atualizado_em=now()`,
    [CHAVE, JSON.stringify(state)],
  )
}

export function activeList(state: CheckinState, now = new Date()) {
  if (!state.enviado_em || !state.lista.length) return []
  const age = now.getTime() - new Date(state.enviado_em).getTime()
  return age >= 0 && age <= LISTA_VALIDA_HORAS * 3_600_000 ? state.lista : []
}
