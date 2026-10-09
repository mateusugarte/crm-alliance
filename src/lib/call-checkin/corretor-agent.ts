import type OpenAI from 'openai'
import { CHAT_MODEL, getOpenAI } from '@/lib/ai/openai-client'
import type { CheckinLead } from './config'
import {
  CHECKIN_DETALHES,
  CHECKIN_RESPOSTAS,
  registrarCheckin,
  type CheckinDetalhe,
  type CheckinResposta,
} from './register'

const MAX_ROUNDS = 3

const SYSTEM_PROMPT = `Voce e o agente de check-in de ligacoes da Alliance Investimentos Imobiliarios.
Todo dia o grupo dos corretores recebe a pergunta "Quais desses leads receberam contato via ligacao?" com uma lista de leads.
Cada corretor responde no grupo citando os leads pelo nome (ou pelo numero da lista) e dizendo se ligou ou nao.
Ex.: "Maria liguei, Jose nao liguei, Ana eu liguei".

Sua UNICA funcao e ler a mensagem do corretor e chamar a tool registrar_ligacao uma vez para cada lead que ele mencionar.
Voce nunca conversa, nunca responde e nunca escreve mensagens no grupo.

- resposta "ligou": o corretor disse que ligou ("liguei", "eu liguei", "sim", "ok", "falei com ele", "ja liguei").
- resposta "nao_ligou": o corretor disse que nao ligou, ainda nao ligou ou vai ligar depois. Um "nao" sozinho e nao_ligou.
- detalhe (opcional, so quando o corretor contar): atendeu, nao_atendeu, caixa_postal, numero_errado. Se ele so disse que ligou, nao envie detalhe.

Regras:
- Identifique o lead pelo nome mais parecido da lista (aceite so o primeiro nome, apelidos obvios e erros de digitacao) ou pelo numero.
- Se um nome puder ser mais de um lead da lista, nao registre esse lead.
- "Todos" vale para a lista inteira.
- Registre somente leads que a mensagem menciona. Nunca invente.
- Se a mensagem nao for uma resposta sobre as ligacoes (conversa, avisos, comentarios dos donos), nao chame nenhuma tool.`

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'registrar_ligacao',
      description: 'Registra no CRM, em nome do corretor que respondeu, se ele ligou ou nao para um lead da lista.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['numero', 'resposta'],
        properties: {
          numero: { type: 'integer', description: 'Numero do lead na lista enviada no grupo.' },
          resposta: { type: 'string', enum: [...CHECKIN_RESPOSTAS] },
          detalhe: { type: 'string', enum: [...CHECKIN_DETALHES], description: 'Somente se o corretor contou como foi a ligacao.' },
        },
      },
    },
  },
]

export interface CheckinAgentResult {
  numero: number
  lead: string
  resposta: CheckinResposta
  detalhe: CheckinDetalhe | null
  status: string
}

/**
 * Agente exclusivo dos corretores: identifica na mensagem do grupo quais
 * leads da lista receberam ligacao e aciona a tool de registro em nome de
 * quem respondeu. Nao produz resposta.
 */
export async function runCorretorCheckinAgent(input: {
  corretorNome: string
  lista: CheckinLead[]
  message: string
}): Promise<CheckinAgentResult[]> {
  const results: CheckinAgentResult[] = []
  const registered = new Set<number>()

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: [
        'Lista enviada no grupo:',
        ...input.lista.map((lead) => `${lead.numero}. ${lead.nome}`),
        '',
        `Mensagem de ${input.corretorNome || 'um corretor'}:`,
        input.message,
      ].join('\n'),
    },
  ]

  for (let round = 0; round < MAX_ROUNDS; round += 1) {
    const completion = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0,
      messages,
      tools: TOOLS,
    })
    const assistant = completion.choices[0]?.message
    const toolCalls = assistant?.tool_calls ?? []
    if (!assistant || !toolCalls.length) break

    messages.push(assistant)
    for (const call of toolCalls) {
      const content = await executeTool(call, input, registered, results)
      messages.push({ role: 'tool', tool_call_id: call.id, content })
    }
  }

  return results
}

async function executeTool(
  call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  input: { corretorNome: string; lista: CheckinLead[]; message: string },
  registered: Set<number>,
  results: CheckinAgentResult[],
) {
  if (call.type !== 'function' || call.function.name !== 'registrar_ligacao') return 'Tool desconhecida.'

  let args: { numero?: unknown; resposta?: unknown; detalhe?: unknown }
  try {
    args = JSON.parse(call.function.arguments || '{}')
  } catch {
    return 'Argumentos invalidos.'
  }

  const numero = Number(args.numero)
  const resposta = args.resposta as CheckinResposta
  const detalhe = CHECKIN_DETALHES.includes(args.detalhe as CheckinDetalhe) && resposta === 'ligou'
    ? args.detalhe as CheckinDetalhe
    : null
  const lead = input.lista.find((item) => item.numero === numero)
  if (!lead) return `Numero ${String(args.numero)} nao existe na lista.`
  if (!CHECKIN_RESPOSTAS.includes(resposta)) return `Resposta invalida: ${String(args.resposta)}.`
  if (registered.has(numero)) return `Lead ${numero} ja foi registrado nesta mensagem.`
  registered.add(numero)

  try {
    const outcome = await registrarCheckin({
      leadId: lead.lead_id,
      resposta,
      detalhe,
      respondente: input.corretorNome,
      mensagem: input.message,
    })
    results.push({ numero, lead: lead.nome, resposta, detalhe, status: outcome.status })
    return `Lead ${numero} (${lead.nome}): ${outcome.status}.`
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erro desconhecido'
    console.error('[call-checkin] falha ao registrar lead', numero, reason)
    results.push({ numero, lead: lead.nome, resposta, detalhe, status: 'erro' })
    return `Falha ao registrar o lead ${numero}: ${reason}.`
  }
}
