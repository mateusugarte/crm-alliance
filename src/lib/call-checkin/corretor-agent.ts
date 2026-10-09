import type OpenAI from 'openai'
import { CHAT_MODEL, getOpenAI } from '@/lib/ai/openai-client'
import type { CheckinLead } from './config'
import { CHECKIN_RESULTADOS, registrarCheckin, type CheckinResultado } from './register'

const MAX_ROUNDS = 3

const SYSTEM_PROMPT = `Voce e o agente de check-in de ligacoes da Alliance Investimentos Imobiliarios.
Todo dia o grupo interno da equipe recebe uma lista numerada de leads qualificados e cada corretor responde no grupo se ligou para eles.
Sua UNICA funcao e ler a mensagem de um corretor no grupo e chamar a tool registrar_ligacao uma vez para cada lead que ele mencionar.
Voce nunca conversa, nunca responde e nunca escreve mensagens para o corretor.

Resultados:
- atendeu: ligou e o lead atendeu/conversou. Use tambem quando o corretor so disser que ligou ("liguei", "sim", "ok", "feito").
- nao_atendeu: ligou e ninguem atendeu, nao respondeu, ocupado, fora de area.
- caixa_postal: ligou e caiu na caixa postal.
- numero_errado: ligou e o numero e errado ou nao existe.
- nao_ligou: disse que nao ligou, ainda nao ligou ou vai ligar depois. Um "nao" sozinho e nao_ligou.

Regras:
- Os leads podem ser citados pelo numero da lista ou pelo nome.
- Faixas ("1 a 3", "1-3") incluem todos os numeros do intervalo. "Todos" vale para a lista inteira.
- Registre somente leads que a mensagem menciona. Nunca invente.
- Se a mensagem nao for uma resposta sobre as ligacoes (conversa, avisos, comentarios dos donos), nao chame nenhuma tool.`

const TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'registrar_ligacao',
      description: 'Registra no CRM se o corretor ligou ou nao para um lead da lista do check-in.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: ['numero', 'resultado'],
        properties: {
          numero: { type: 'integer', description: 'Numero do lead na lista enviada no grupo.' },
          resultado: { type: 'string', enum: [...CHECKIN_RESULTADOS] },
        },
      },
    },
  },
]

export interface CheckinAgentResult {
  numero: number
  resultado: CheckinResultado
  status: string
}

/**
 * Agente exclusivo dos corretores: identifica na mensagem quais leads da lista
 * receberam ligacao e aciona a tool de registro. Nao produz resposta.
 */
export async function runCorretorCheckinAgent(input: {
  corretorNome: string
  lista: CheckinLead[]
  message: string
}): Promise<CheckinAgentResult[]> {
  const { corretorNome } = input
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
        `Mensagem do corretor ${corretorNome || ''}:`.trim(),
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
      const content = await executeTool(call, input.lista, registered, corretorNome, input.message, results)
      messages.push({ role: 'tool', tool_call_id: call.id, content })
    }
  }

  return results
}

async function executeTool(
  call: OpenAI.Chat.Completions.ChatCompletionMessageToolCall,
  lista: CheckinLead[],
  registered: Set<number>,
  corretorNome: string,
  message: string,
  results: CheckinAgentResult[],
) {
  if (call.type !== 'function' || call.function.name !== 'registrar_ligacao') return 'Tool desconhecida.'

  let args: { numero?: unknown; resultado?: unknown }
  try {
    args = JSON.parse(call.function.arguments || '{}')
  } catch {
    return 'Argumentos invalidos.'
  }

  const numero = Number(args.numero)
  const resultado = args.resultado as CheckinResultado
  const lead = lista.find((item) => item.numero === numero)
  if (!lead) return `Numero ${String(args.numero)} nao existe na lista.`
  if (!CHECKIN_RESULTADOS.includes(resultado)) return `Resultado invalido: ${String(args.resultado)}.`
  if (registered.has(numero)) return `Lead ${numero} ja foi registrado nesta mensagem.`
  registered.add(numero)

  try {
    const outcome = await registrarCheckin({ leadId: lead.lead_id, resultado, corretorNome, mensagem: message })
    results.push({ numero, resultado, status: outcome.status })
    return `Lead ${numero} (${lead.nome}): ${outcome.status}.`
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'erro desconhecido'
    console.error('[call-checkin] falha ao registrar lead', numero, reason)
    results.push({ numero, resultado, status: 'erro' })
    return `Falha ao registrar o lead ${numero}: ${reason}.`
  }
}
