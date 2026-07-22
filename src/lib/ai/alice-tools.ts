import type OpenAI from 'openai'
import type { Database } from '@/lib/supabase/types'
import { searchKnowledgeBase } from './rag'

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
  | 'reenviar_pdf'

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
    pdf_enviado?: boolean
  }
}

export interface AliceToolContext {
  lead: Lead
  imoveis: Imovel[]
  state: AliceToolState
}

export const aliceTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'info',
      description:
        'Fonte unica de verdade sobre o La Reserva (busca semantica na base de conhecimento real). Use antes de responder perguntas sobre produto, obra, entrega, lazer, objecoes e condicoes gerais.',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'imoveis',
      description:
        'Consulta unidades disponiveis do Supabase. Use antes de apresentar opcoes de metragem, quartos, pavimento, unidade ou valores reais.',
      parameters: {
        type: 'object',
        properties: {
          quartos: { type: 'number', description: 'Quantidade de quartos desejada, se informada.' },
          metragem_min: { type: 'number', description: 'Metragem minima desejada, se informada.' },
          cobertura: { type: 'boolean', description: 'Se o lead pediu cobertura.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulacao',
      description:
        'Busca as condicoes de pagamento reais (entrada, parcelas, aportes anuais) na base de conhecimento e cruza com os valores reais das unidades. Use em qualquer mensagem sobre valor, preco, parcela, entrada ou condicao de pagamento.',
      parameters: {
        type: 'object',
        properties: {
          unidade: { type: 'string', description: 'Numero ou descricao da unidade de interesse, se houver.' },
          perfil: { type: 'string', description: 'Perfil buscado pelo lead, se houver.' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'leads',
      description: 'Registra dados coletados do lead nesta interacao.',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'qualificado',
      description: 'Ative imediatamente quando o lead aceitar falar com consultor. Inclua resumo e imovel de interesse.',
      parameters: {
        type: 'object',
        properties: {
          resumo: { type: 'string' },
          imovel: { type: 'string' },
        },
        required: ['resumo'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pausar_IA',
      description: 'Pausa a IA quando o lead aceitou consultor ou disse que vai verificar com alguem e retornar.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'aceitou_ligacao',
      description: 'Marca que o lead aceitou contato de consultor por ligacao ou mensagem direta.',
      parameters: {
        type: 'object',
        properties: {
          observacao: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'stop',
      description: 'Use quando o lead nao tem interesse, ja comprou, nao pode comprar, for bot/IA/empresa ou algo impossibilitar compra.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reenviar_pdf',
      description: 'Use somente quando o lead pedir explicitamente para receber o PDF do La Reserva novamente. Nunca use por conta propria.',
      parameters: {
        type: 'object',
        properties: {
          motivo: { type: 'string' },
        },
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
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
}

export async function executeAliceTool(context: AliceToolContext, name: string, input: unknown): Promise<string> {
  const args = asRecord(input)
  const { state } = context

  switch (name) {
    case 'info': {
      const topic = String(args.topic ?? '')
      try {
        const chunks = await searchKnowledgeBase(topic, 5)
        if (!chunks.length) {
          return 'Nada encontrado na base de conhecimento para este topico. Diga que confirma com o time e retorna.'
        }
        return chunks.map((c) => c.content).join('\n---\n')
      } catch (err) {
        return `Erro ao consultar a base de conhecimento (${(err as Error).message}). Diga que confirma com o time e retorna.`
      }
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

      let condicoes = ''
      try {
        const chunks = await searchKnowledgeBase(
          `condicoes de pagamento, entrada, parcelas, aportes anuais ${String(args.perfil ?? '')}`,
          3
        )
        condicoes = chunks.map((c) => c.content).join('\n---\n')
      } catch (err) {
        condicoes = `(condicoes de pagamento indisponiveis: ${(err as Error).message})`
      }

      return [
        'Use somente estas faixas e condicoes reais. Nao invente entrada, desconto, taxa, prazo ou parcela especifica.',
        'Informe que simulacoes detalhadas e negociacao acontecem com o consultor.',
        'CONDICOES DE PAGAMENTO (base de conhecimento):',
        condicoes || 'nao encontrado',
        'UNIDADES:',
        base.length ? base.map(describeImovel).join('\n') : 'nao ha unidades disponiveis retornadas pelo Supabase.',
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

    case 'reenviar_pdf': {
      addAction(state, 'reenviar_pdf')
      return 'PDF marcado para reenvio nesta resposta.'
    }

    default:
      return `Tool desconhecida: ${name}`
  }
}
