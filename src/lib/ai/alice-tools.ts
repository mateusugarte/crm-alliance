import type OpenAI from 'openai'
import type { Database } from '@/lib/supabase/types'
import { searchKnowledgeBase } from './rag'
import { createServiceClient } from '@/lib/supabase/service'
import { sendDocumentMessage, sendTextMessage } from '@/lib/whatsapp/send'
import { toWhatsAppNumber } from '@/lib/format-phone'

type Lead = Database['public']['Tables']['leads']['Row']
type Imovel = Database['public']['Tables']['imoveis']['Row']

const LA_RESERVA_PDF_URL =
  process.env.LA_RESERVA_PDF_URL ||
  'https://lmvdruvmpybutmmidrfp.supabase.co/storage/v1/object/public/la%20reserva/LaReserva%20(2).pdf'
const LA_RESERVA_PDF_CAPTION = 'PDF de apresentacao do La Reserva'

const QUALIFICADO_ALERT_GROUP_JID = process.env.QUALIFICADO_ALERT_GROUP_JID || '120363429109259182@g.us'

async function getConnectedInstanceToken(): Promise<string | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('wa_instances')
    .select('instance_id')
    .eq('status', 'connected')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return (data as { instance_id: string } | null)?.instance_id ?? null
}

export type AliceToolName =
  | 'leads'
  | 'imoveis'
  | 'simulacao'
  | 'info'
  | 'qualificado'
  | 'pausar_IA'
  | 'aceitou_ligacao'
  | 'stop'
  | 'enviar_pdf'

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
      description:
        'Ative imediatamente quando o lead aceitar falar com consultor. Inclua resumo e imovel de interesse. Essa tool tambem notifica de verdade o grupo interno da equipe no WhatsApp — nao anuncie isso ao lead.',
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
      name: 'enviar_pdf',
      description:
        'Envia de verdade o PDF de apresentacao do La Reserva pelo WhatsApp do lead. Ative na primeira interacao (pdf_enviado=false) e sempre que o lead pedir para receber o PDF novamente. Nao ative fora desses dois casos.',
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

      try {
        const instanceToken = await getConnectedInstanceToken()
        if (!instanceToken) {
          return 'Lead marcado como qualificado, mas falha ao notificar o grupo: nenhuma instancia do WhatsApp conectada.'
        }

        const numero = toWhatsAppNumber(context.lead.phone)
        const resumo = state.lead_updates.summary || context.lead.summary || 'nao informado'
        const nome = state.lead_updates.name ?? context.lead.name
        const cidade = state.lead_updates.city ?? context.lead.city
        const intencao = state.lead_updates.intention ?? context.lead.intention
        const imovel = state.lead_updates.imovel_interesse ?? context.lead.imovel_interesse

        const infoColetada = [
          nome ? `Nome: ${nome}` : null,
          cidade ? `Cidade: ${cidade}` : null,
          intencao ? `Intencao: ${intencao}` : null,
          imovel ? `Imovel de interesse: ${imovel}` : null,
        ]
          .filter(Boolean)
          .join('\n')

        const message = [
          '🚨ATENÇÃO🚨',
          '',
          `Cliente qualificado: ${numero}`,
          '',
          `Resumo da conversa: ${resumo}`,
          '',
          `Informações coletadas na conversa: ${infoColetada || 'nao informado'}`,
          '',
          'entre em contato rapidamente e atenda-o',
          '',
          'IA PAUSADA 🛑🤖',
        ].join('\n')

        const result = await sendTextMessage(instanceToken, QUALIFICADO_ALERT_GROUP_JID, message)
        if (!result.success) {
          return `Lead marcado como qualificado, mas falha ao notificar o grupo (${result.error}).`
        }

        return 'Lead marcado como qualificado para contato do consultor e grupo notificado com sucesso.'
      } catch (err) {
        return `Lead marcado como qualificado, mas erro ao notificar o grupo (${(err as Error).message}).`
      }
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

    case 'enviar_pdf': {
      if (state.actions.includes('enviar_pdf')) {
        return 'PDF ja foi enviado nesta mesma resposta. Nao ative de novo, apenas siga a conversa.'
      }
      addAction(state, 'enviar_pdf')

      try {
        const instanceToken = await getConnectedInstanceToken()
        if (!instanceToken) {
          return 'Falha ao enviar o PDF: nenhuma instancia do WhatsApp conectada. Nao diga ao lead que enviou — diga que vai confirmar com o time.'
        }

        const to = toWhatsAppNumber(context.lead.phone)
        const result = await sendDocumentMessage(instanceToken, to, LA_RESERVA_PDF_URL, LA_RESERVA_PDF_CAPTION)

        if (!result.success) {
          return `Falha ao enviar o PDF (${result.error}). Nao diga ao lead que enviou — diga que vai confirmar com o time.`
        }

        state.lead_updates.pdf_enviado = true
        return 'PDF enviado com sucesso para o WhatsApp do lead.'
      } catch (err) {
        return `Erro ao enviar o PDF (${(err as Error).message}). Nao diga ao lead que enviou — diga que vai confirmar com o time.`
      }
    }

    default:
      return `Tool desconhecida: ${name}`
  }
}
