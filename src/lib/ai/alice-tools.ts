import type { Tool } from '@anthropic-ai/sdk/resources/messages'
import type { Database } from '@/lib/supabase/types'

type Lead = Database['public']['Tables']['leads']['Row']
type Imovel = Database['public']['Tables']['imoveis']['Row']

export type AliceToolName =
  | 'leads'
  | 'imoveis'
  | 'simulacao'
  | 'info'
  | 'qualificado'
  | 'pausar_IA'
  | 'aceitou_ligacao'
  | 'stop'

export interface AliceToolState {
  actions: AliceToolName[]
  lead_updates: {
    name?: string | null
    city?: string | null
    intention?: 'morar' | 'investir' | null
    imovel_interesse?: string | null
    stage?: Lead['stage']
    summary?: string | null
    automation_paused?: boolean
    aceitou_consultor?: boolean | null
  }
}

export interface AliceToolContext {
  lead: Lead
  imoveis: Imovel[]
  state: AliceToolState
}

export const aliceTools: Tool[] = [
  {
    name: 'info',
    description: 'Fonte unica de verdade sobre o La Reserva. Use antes de responder perguntas sobre produto, obra, entrega, lazer, objecoes e condicoes gerais.',
    input_schema: {
      type: 'object',
      properties: {
        topic: {
          type: 'string',
          description: 'Assunto consultado, por exemplo: obra, entrega, lazer, valores, localizacao, objecao.',
        },
      },
      required: ['topic'],
    },
  },
  {
    name: 'imoveis',
    description: 'Consulta unidades disponiveis do Supabase. Use antes de apresentar opcoes de metragem, quartos, pavimento, unidade ou valores reais.',
    input_schema: {
      type: 'object',
      properties: {
        quartos: { type: 'number', description: 'Quantidade de quartos desejada, se informada.' },
        metragem_min: { type: 'number', description: 'Metragem minima desejada, se informada.' },
        cobertura: { type: 'boolean', description: 'Se o lead pediu cobertura.' },
      },
    },
  },
  {
    name: 'simulacao',
    description: 'Use em qualquer mensagem sobre valor, preco, parcela, entrada, condicao de pagamento ou simulacao.',
    input_schema: {
      type: 'object',
      properties: {
        unidade: { type: 'string', description: 'Numero ou descricao da unidade de interesse, se houver.' },
        perfil: { type: 'string', description: 'Perfil buscado pelo lead, se houver.' },
      },
    },
  },
  {
    name: 'leads',
    description: 'Registra dados coletados do lead nesta interacao.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string' },
        cidade: { type: 'string' },
        intencao: { type: 'string', enum: ['morar', 'investir'] },
        imovel: { type: 'string' },
        resumo: { type: 'string' },
      },
    },
  },
  {
    name: 'qualificado',
    description: 'Ative imediatamente quando o lead aceitar falar com consultor. Inclua resumo e imovel de interesse.',
    input_schema: {
      type: 'object',
      properties: {
        resumo: { type: 'string' },
        imovel: { type: 'string' },
      },
      required: ['resumo'],
    },
  },
  {
    name: 'pausar_IA',
    description: 'Pausa a IA quando o lead aceitou consultor ou disse que vai verificar com alguem e retornar.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string' },
      },
    },
  },
  {
    name: 'aceitou_ligacao',
    description: 'Marca que o lead aceitou contato de consultor por ligacao ou mensagem direta.',
    input_schema: {
      type: 'object',
      properties: {
        observacao: { type: 'string' },
      },
    },
  },
  {
    name: 'stop',
    description: 'Use quando o lead nao tem interesse, ja comprou, nao pode comprar, for bot/IA/empresa ou algo impossibilitar compra.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string' },
      },
    },
  },
]

function addAction(state: AliceToolState, action: AliceToolName) {
  if (!state.actions.includes(action)) state.actions.push(action)
}

function money(value: number | null) {
  if (value == null) return 'nao informado'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function describeImovel(item: Imovel) {
  const faixa =
    item.valor_min != null || item.valor_max != null
      ? `${money(item.valor_min)} ate ${money(item.valor_max)}`
      : 'valor nao informado'

  return [
    `Unidade ${item.numero_unidade}, pavimento ${item.pavimento}`,
    item.nome,
    `${item.metragem}m2`,
    `${item.quartos} quartos`,
    `${item.suites} suites`,
    item.cobertura ? 'cobertura' : 'apartamento',
    `faixa: ${faixa}`,
    item.diferenciais?.length ? `diferenciais: ${item.diferenciais.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' | ')
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? input as Record<string, unknown> : {}
}

export function executeAliceTool(context: AliceToolContext, name: string, input: unknown) {
  const args = asRecord(input)
  const { state } = context

  switch (name) {
    case 'info': {
      return [
        'Informacoes confirmadas sobre o La Reserva:',
        '- Empreendimento em Castelo, ES.',
        '- Obra iniciada em marco de 2026.',
        '- Entrega prevista para fevereiro de 2030.',
        '- Valorizacao e sempre uma projecao, nunca uma garantia.',
        '- O La Reserva nao tem piscina.',
        '- Nao confirme frente para montanhas, sol, vista linda ou localizacao tranquila sem validacao do time.',
        '- Se algo nao estiver nestes dados ou nas unidades disponiveis, diga que confirma com o time e retorna.',
        `Topico consultado: ${String(args.topic ?? 'geral')}`,
      ].join('\n')
    }

    case 'imoveis': {
      const quartos = typeof args.quartos === 'number' ? args.quartos : null
      const metragemMin = typeof args.metragem_min === 'number' ? args.metragem_min : null
      const cobertura = typeof args.cobertura === 'boolean' ? args.cobertura : null

      const filtered = context.imoveis.filter((item) => {
        if (quartos != null && item.quartos !== quartos) return false
        if (metragemMin != null && item.metragem < metragemMin) return false
        if (cobertura != null && item.cobertura !== cobertura) return false
        return item.disponivel && !item.vendido
      })

      const list = filtered.length ? filtered : context.imoveis.filter((item) => item.disponivel && !item.vendido)
      if (!list.length) return 'Nenhum imovel disponivel retornado pelo Supabase.'

      return list.slice(0, 12).map(describeImovel).join('\n')
    }

    case 'simulacao': {
      const unidade = String(args.unidade ?? '').replace(/\D/g, '')
      const matches = unidade
        ? context.imoveis.filter((item) => String(item.numero_unidade) === unidade)
        : context.imoveis.filter((item) => item.disponivel && !item.vendido).slice(0, 6)

      const base = matches.length ? matches : context.imoveis.filter((item) => item.disponivel && !item.vendido).slice(0, 6)
      if (!base.length) return 'Nao ha unidades disponiveis com valores retornadas pelo Supabase.'

      return [
        'Use somente estas faixas reais. Nao invente entrada, desconto, taxa, prazo ou parcela especifica.',
        'Informe que simulacoes detalhadas e negociacao acontecem com o consultor.',
        ...base.map(describeImovel),
      ].join('\n')
    }

    case 'leads': {
      addAction(state, 'leads')
      if (typeof args.nome === 'string' && args.nome.trim()) state.lead_updates.name = args.nome.trim()
      if (typeof args.cidade === 'string') state.lead_updates.city = args.cidade.trim() || null
      if (args.intencao === 'morar' || args.intencao === 'investir') state.lead_updates.intention = args.intencao
      if (typeof args.imovel === 'string') state.lead_updates.imovel_interesse = args.imovel.trim() || null
      if (typeof args.resumo === 'string') state.lead_updates.summary = args.resumo.trim() || null
      return `Dados registrados para o lead ${context.lead.id}.`
    }

    case 'qualificado': {
      addAction(state, 'qualificado')
      state.lead_updates.stage = 'lead_quente'
      if (typeof args.resumo === 'string') state.lead_updates.summary = args.resumo.trim()
      if (typeof args.imovel === 'string') state.lead_updates.imovel_interesse = args.imovel.trim() || null
      return 'Lead marcado como qualificado para contato do consultor.'
    }

    case 'pausar_IA': {
      addAction(state, 'pausar_IA')
      state.lead_updates.automation_paused = true
      return 'IA marcada para pausa neste lead.'
    }

    case 'aceitou_ligacao': {
      addAction(state, 'aceitou_ligacao')
      state.lead_updates.aceitou_consultor = true
      return 'Lead marcado como aceitou contato de consultor.'
    }

    case 'stop': {
      addAction(state, 'stop')
      state.lead_updates.automation_paused = true
      state.lead_updates.stage = 'lead_frio'
      if (typeof args.motivo === 'string') state.lead_updates.summary = args.motivo.trim()
      return 'Atendimento automatico encerrado para este lead.'
    }

    default:
      return `Tool desconhecida: ${name}`
  }
}
