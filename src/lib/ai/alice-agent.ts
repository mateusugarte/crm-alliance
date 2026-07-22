import type OpenAI from 'openai'
import { getOpenAI, CHAT_MODEL } from './openai-client'
import { aliceTools, executeAliceTool, type AliceToolState } from '@/lib/ai/alice-tools'
import type { Database } from '@/lib/supabase/types'

type Lead = Database['public']['Tables']['leads']['Row']
type Imovel = Database['public']['Tables']['imoveis']['Row']
type Interaction = Database['public']['Tables']['interactions']['Row']

export type AliceAction =
  | 'leads'
  | 'qualificado'
  | 'pausar_IA'
  | 'aceitou_ligacao'
  | 'stop'
  | 'reenviar_pdf'

export interface AliceAgentInput {
  lead: Lead
  message: string
  history: Pick<Interaction, 'direction' | 'sender_type' | 'sender_name' | 'content' | 'created_at'>[]
  imoveis: Imovel[]
  nowIso: string
  reactivation?: boolean
}

export interface AliceAgentOutput {
  reply: string | null
  actions: AliceAction[]
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
  internal_summary?: string | null
  send_pdf?: boolean
}

function money(value: number | null) {
  if (value == null) return 'nao informado'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function buildImoveisContext(imoveis: Imovel[]) {
  if (!imoveis.length) return 'Nenhum imovel disponivel retornado pelo Supabase.'

  return imoveis
    .map((item) => {
      const faixa =
        item.valor_min != null || item.valor_max != null
          ? `${money(item.valor_min)} ate ${money(item.valor_max)}`
          : 'valor nao informado'

      return [
        `Unidade ${item.numero_unidade}, pavimento ${item.pavimento}`,
        `${item.nome}`,
        `${item.metragem}m2`,
        `${item.quartos} quartos`,
        `${item.suites} suites`,
        item.cobertura ? 'cobertura' : 'apartamento',
        `faixa: ${faixa}`,
        item.diferenciais?.length ? `diferenciais: ${item.diferenciais.join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' | ')
    })
    .join('\n')
}

function buildHistory(history: AliceAgentInput['history']) {
  if (!history.length) return 'Sem historico anterior.'

  return history
    .map((item) => {
      const who =
        item.sender_type === 'lead'
          ? 'Lead'
          : item.sender_type === 'corretor'
            ? `Corretor${item.sender_name ? ` (${item.sender_name})` : ''}`
            : 'Alice'
      return `${who}: ${item.content}`
    })
    .join('\n')
}

function systemPrompt(input: AliceAgentInput) {
  return `Voce e Alice, consultora da Alliance Investimentos Imobiliarios, responsavel pelo atendimento do La Reserva em Castelo, ES.

Responda em portugues brasileiro, como WhatsApp, com formalidade leve. Seja simpatica, especialista e curiosa. Use respostas curtas a medias, idealmente ate 60 palavras. Nao use markdown, asteriscos ou listas longas na resposta ao lead.

REGRA MECANICA DE FLUXO
via_disparo do lead atual: ${input.lead.via_disparo === true ? 'true' : 'false'}
- Se via_disparo for exatamente true, use FLUXO A.
- Caso contrario, use FLUXO B.
- Mantenha o mesmo fluxo durante a conversa.
- Essa determinacao e so para seu raciocinio interno. Nunca escreva "via_disparo", "FLUXO A" ou "FLUXO B" na mensagem enviada ao lead.

FLUXO A - lead de disparo
Objetivo unico: despertar interesse nas condicoes especiais e repassar para consultor por ligacao ou mensagem.
Nao aplique trava de 4 necessidades. Nao proponha data. Se houver interesse, conduza para aceitar contato de consultor.
Ao aceitar consultor, retorne actions: aceitou_ligacao, qualificado, pausar_IA.

FLUXO B - padrao
pdf_enviado do lead atual: ${input.lead.pdf_enviado ? 'true' : 'false'}
- Se pdf_enviado for false, esta e a primeira interacao com este lead. Nessa ordem, na mesma mensagem: primeiro cumprimente conforme o horario, depois pergunte como pode chamar o lead, e so por ultimo diga que esta te enviando agora o PDF de apresentacao do La Reserva. Nunca comece a mensagem falando do PDF.
- Se pdf_enviado for true, NAO mencione envio de PDF por conta propria. So volte a falar do PDF se o lead pedir explicitamente para receber de novo; nesse caso, use a tool reenviar_pdf e confirme o reenvio na resposta.
Depois colete um dado por vez, em conversa natural: nome, cidade, intencao morar/investir, se conhecia o La Reserva, metragem, quartos.
Antes de valores, mapeie no minimo 4 necessidades. Se pedir valores antes, responda brevemente que chega nisso em breve e continue descoberta.
Para valores, use somente dados reais dos imoveis disponiveis e da tool simulacao. Nunca invente preco, desconto, prazo, vaga ou beneficio.
Para consultor: so conduza depois de 4 necessidades, valores apresentados e interesse real. Ao aceitar consultor, retorne actions: qualificado, aceitou_ligacao, pausar_IA.

RECONTATO MANUAL
reactivation desta chamada: ${input.reactivation ? 'true' : 'false'}
- Se reactivation for true, este e um recontato manual disparado pela equipe apos um periodo sem resposta nesta conversa. Comece a resposta cumprimentando conforme o horario (bom dia/boa tarde/boa noite), pergunte como o lead esta, e se reapresente rapidamente como Alice da Alliance antes de continuar. So faca isso na mensagem atual; verifique o HISTORICO RECENTE abaixo e, se ja houver uma saudacao de recontato sua, nao repita.
- Se reactivation for false, nao adicione nenhuma saudacao extra de recontato.

NAO REPITA PERGUNTAS OU INFORMACOES
Antes de perguntar qualquer dado de qualificacao (nome, cidade, intencao morar/investir, se conhecia o La Reserva, metragem, quartos, imovel de interesse) ou de reexplicar qualquer informacao, verifique DADOS ATUAIS DO LEAD e TODO o HISTORICO RECENTE abaixo — incluindo mensagens marcadas como Corretor (atendimento humano), nao so as do Lead.
Se o dado ja aparecer preenchido, ou se o lead ja tiver dito isso em qualquer ponto da conversa (mesmo como resposta a outra pergunta, de forma espontanea, ou em resposta a um Corretor), chame a tool leads imediatamente para registrar e siga para o proximo passo sem perguntar de novo.
Se um Corretor ja perguntou, respondeu ou explicou algo nesta conversa, trate como resolvido: nao repita a mesma pergunta nem reexplique a mesma informacao do zero. So volte ao assunto se o lead pedir de novo ou trouxer uma duvida nova sobre ele.
Exemplo: se o lead disser "quero investir" mesmo sem voce ter perguntado, registre intencao=investir via tool leads e nao pergunte "quer morar ou investir". Exemplo: se um Corretor ja explicou as condicoes de financiamento nesta conversa, nao reexplique do zero quando o assunto voltar — continue dali.

REGRA DE OURO
Antes de conduzir o fluxo, responda o que o lead perguntou. Nunca ignore pergunta. Se a informacao nao estiver nos dados, diga: "Essa informacao eu confirmo com nosso time e te passo em seguida."

CONTEXTO FIXO DO LA RESERVA
- Obra iniciada em marco de 2026.
- Entrega prevista em fevereiro de 2030.
- Valorizacao e projecao, jamais garantia.
- O La Reserva nao tem piscina.
- Nao informe que e de frente para montanhas ou sol.
- Nao diga que a localizacao e tranquila ou que a vista e linda, exceto se perguntado e com cautela.
- Nao use as expressoes: alto padrao, altissimo nivel, sofisticacao, excelencia, diferenciado.
- Atenda somente assuntos do La Reserva.
- Nao ofereca audios; ofereca conversa com consultor.

FERRAMENTAS DISPONIVEIS COMO ACTIONS
Voce tem tools reais conectadas ao CRM. Use-as antes de montar a resposta final:
- info: obrigatoria para verificar informacoes sobre o La Reserva (busca semantica na base de conhecimento real).
- imoveis: obrigatoria antes de falar sobre unidades, metragem, quartos, pavimento ou disponibilidade.
- simulacao: obrigatoria antes de qualquer resposta sobre valor, preco, parcela, entrada ou condicao (busca as condicoes reais de pagamento + valores das unidades).
- leads: quando coletar ou atualizar nome, cidade, intencao, imovel de interesse ou resumo.
- qualificado: apenas quando o lead aceitar falar com consultor; inclua resumo.
- aceitou_ligacao: quando aceitar contato de consultor.
- pausar_IA: quando aceitar consultor ou disser que vai verificar com alguem e retornar.
- stop: quando nao tem interesse, ja comprou, nao pode comprar, for bot/IA/empresa ou assunto impossibilitar compra.
- reenviar_pdf: somente quando o lead pedir explicitamente para receber o PDF novamente.

Depois de usar as tools necessarias, retorne o JSON final. O JSON final deve refletir as tools acionadas.

DADOS ATUAIS DO LEAD
id: ${input.lead.id}
nome: ${input.lead.name || 'nao informado'}
telefone: ${input.lead.phone}
cidade: ${input.lead.city || 'nao informado'}
intencao: ${input.lead.intention || 'nao informado'}
imovel_interesse: ${input.lead.imovel_interesse || 'nao informado'}
stage: ${input.lead.stage}
automation_paused: ${input.lead.automation_paused}
aceitou_consultor: ${input.lead.aceitou_consultor ?? 'nao informado'}
pdf_enviado: ${input.lead.pdf_enviado ? 'true' : 'false'}
summary: ${input.lead.summary || 'nao informado'}

IMOVEIS DISPONIVEIS DO SUPABASE
${buildImoveisContext(input.imoveis)}

HISTORICO RECENTE
${buildHistory(input.history)}

FORMATO OBRIGATORIO
Depois de usar as tools necessarias, sua ULTIMA mensagem de texto (sem tool call) deve ser somente JSON valido, sem texto fora do JSON:
{
  "reply": "mensagem para o lead ou null",
  "actions": ["leads"],
  "lead_updates": {
    "name": "nome se coletado",
    "city": "cidade se coletada",
    "intention": "morar ou investir se coletado",
    "imovel_interesse": "unidade/perfil se coletado",
    "stage": "nao_respondeu|lead_frio|lead_morno|lead_quente|follow_up|reuniao_agendada|visita_confirmada|cliente",
    "summary": "resumo util para corretor",
    "automation_paused": false,
    "aceitou_consultor": false
  },
  "internal_summary": "resumo curto do raciocinio operacional"
}`
}

function parseJson(text: string): AliceAgentOutput {
  const trimmed = text.trim()
  const jsonText = trimmed.startsWith('{')
    ? trimmed
    : trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1)

  const parsed = JSON.parse(jsonText) as AliceAgentOutput

  return {
    reply: typeof parsed.reply === 'string' ? parsed.reply.trim() : null,
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
    lead_updates: parsed.lead_updates && typeof parsed.lead_updates === 'object' ? parsed.lead_updates : {},
    internal_summary: parsed.internal_summary ?? null,
  }
}

export async function runAliceAgent(input: AliceAgentInput): Promise<AliceAgentOutput> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }

  const openai = getOpenAI()
  const toolState: AliceToolState = { actions: [], lead_updates: {} }

  const currentMessageLabel = input.reactivation
    ? 'Nota interna da equipe (motivo do recontato, pode nao ser fala literal do lead)'
    : 'Mensagem atual do lead'

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt(input) },
    { role: 'user', content: `Horario atual: ${input.nowIso}\n${currentMessageLabel}: ${input.message}` },
  ]

  let result: OpenAI.Chat.Completions.ChatCompletionMessage | null = null

  for (let i = 0; i < 6; i += 1) {
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.4,
      tools: aliceTools,
      messages,
    })

    result = response.choices[0].message
    messages.push(result)

    const toolCalls = result.tool_calls?.filter((call) => call.type === 'function') ?? []
    if (!toolCalls.length) break

    for (const call of toolCalls) {
      let parsedArgs: unknown = {}
      try {
        parsedArgs = JSON.parse(call.function.arguments || '{}')
      } catch {
        parsedArgs = {}
      }

      const toolResult = await executeAliceTool(
        { lead: input.lead, imoveis: input.imoveis, state: toolState },
        call.function.name,
        parsedArgs
      )

      messages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: toolResult,
      })
    }
  }

  if (!result) {
    throw new Error('Alice agent did not return a response')
  }

  if (result.tool_calls?.filter((call) => call.type === 'function').length) {
    const forced = await openai.chat.completions.create({
      model: CHAT_MODEL,
      temperature: 0.4,
      messages: [
        ...messages,
        { role: 'user', content: 'Responda agora apenas com o JSON final, sem novas tool calls.' },
      ],
    })
    result = forced.choices[0].message
  }

  const MAX_JSON_ATTEMPTS = 6
  let parsed: AliceAgentOutput | null = null
  let silentFailure = false

  for (let attempt = 1; attempt <= MAX_JSON_ATTEMPTS; attempt += 1) {
    try {
      parsed = parseJson(result.content ?? '')
      break
    } catch (err) {
      console.error(`[alice-agent] failed to parse model output (attempt ${attempt}/${MAX_JSON_ATTEMPTS})`, err, result.content)

      if (attempt === MAX_JSON_ATTEMPTS) {
        console.error('[alice-agent] exhausted all attempts, staying silent')
        parsed = { reply: null, actions: [], lead_updates: {} }
        silentFailure = true
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 5000))

      const retry = await openai.chat.completions.create({
        model: CHAT_MODEL,
        temperature: 0.4,
        messages: [
          ...messages,
          { role: 'user', content: 'Responda agora apenas com o JSON final, sem novas tool calls.' },
        ],
      })
      result = retry.choices[0].message
    }
  }

  if (!parsed) {
    throw new Error('Alice agent did not produce a parsed output')
  }

  const firstPdfSend = !input.lead.pdf_enviado && !silentFailure
  const allActions = [...new Set([...toolState.actions, ...parsed.actions])] as AliceAction[]
  const sendPdf = !silentFailure && (firstPdfSend || allActions.includes('reenviar_pdf'))

  return {
    ...parsed,
    actions: allActions,
    lead_updates: {
      ...toolState.lead_updates,
      ...parsed.lead_updates,
      ...(firstPdfSend ? { pdf_enviado: true } : {}),
    },
    send_pdf: sendPdf,
  }
}
