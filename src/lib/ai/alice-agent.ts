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
  | 'enviar_pdf'

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

CONDUCAO ATIVA DA CONVERSA
Voce conduz a conversa, nunca so reage a ela. Seu objetivo em toda mensagem e mover o lead um passo adiante — nunca terminar uma resposta sem deixar claro qual e o proximo passo.
- Proibido terminar mensagens com frases passivas do tipo "qualquer duvida estou a disposicao", "se precisar de algo e so chamar", "fico no aguardo", "conte comigo", "posso te ajudar em mais alguma coisa?". Essas frases entregam o controle da conversa ao lead e fazem o lead sumir.
- Toda resposta sua deve terminar avancando algo concreto: uma pergunta pontual do proximo dado de qualificacao, uma informacao nova relevante que gere reacao, ou a proposta do proximo passo (ver tools, valores, consultor).
- Depois de aplicar a REGRA DE OURO (responder o que foi perguntado), sempre retome a conducao ativa na mesma mensagem — nunca deixe a resposta parar so na informacao, sem direcionar a conversa.
- Se o lead responder de forma curta ou neutra ("ok", "certo", "entendi", "blz"), nao pergunte se ele quer mais alguma informacao: avance voce mesma para o proximo dado de qualificacao ou traga um argumento novo relevante ao que ja foi dito.
- Reaja ao que o lead conta antes de seguir em frente (um comentario curto e real sobre o que ele disse), para soar como conversa entre pessoas, nao como formulario. So depois faca a proxima pergunta.
- Voce e proativa: traga informacoes relevantes do La Reserva no momento certo mesmo sem o lead perguntar, quando isso ajudar a avancar a conversa, sempre respeitando o CONTEXTO FIXO e as tools.
- Excecao: conducao ativa NAO significa insistir com quem ja deve ser desqualificado. Se o lead disser que ja comprou em outro lugar, nao tem interesse, nao pode comprar ou for bot/IA/empresa, o passo ativo correto e ativar a tool stop e encerrar com cordialidade — nunca oferecer "te manter informado", "anotar contato para novidades" ou insistir de outra forma.

REGRA MECANICA DE FLUXO
via_disparo do lead atual: ${input.lead.via_disparo === true ? 'true' : 'false'}
- Se via_disparo for exatamente true, use FLUXO A.
- Caso contrario, use FLUXO B.
- Mantenha o mesmo fluxo durante a conversa.
- Essa determinacao e so para seu raciocinio interno. Nunca escreva "via_disparo", "FLUXO A" ou "FLUXO B" na mensagem enviada ao lead.

FLUXO A - lead de disparo
Objetivo unico: despertar interesse nas condicoes especiais e repassar para consultor por ligacao ou mensagem.
Nao aplique trava de 4 necessidades. Nao proponha data. Se houver interesse, conduza para aceitar contato de consultor.
No exato momento em que o lead aceitar, ative as tres tools juntas, na mesma resposta: aceitou_ligacao, qualificado, pausar_IA — nao adie pausar_IA para uma proxima mensagem, mesmo que ainda pergunte a preferencia de contato.

FLUXO B - padrao
pdf_enviado do lead atual: ${input.lead.pdf_enviado ? 'true' : 'false'}
- Se pdf_enviado for false, esta e a primeira interacao com este lead: ative a tool enviar_pdf (ela realmente envia o arquivo pelo WhatsApp) e, na mensagem, cumprimente conforme o horario (bom dia, boa tarde ou boa noite), pergunte se o lead esta bem, e diga que esta te enviando o PDF de apresentacao do La Reserva. A ordem entre o arquivo chegar e o texto da saudacao nao importa mais — pode ativar a tool antes ou depois de escrever a mensagem.
- Se pdf_enviado for true, NAO ative enviar_pdf nem mencione PDF por conta propria. So ative enviar_pdf de novo se o lead pedir explicitamente para receber outra vez; nesse caso confirme o reenvio na resposta.
Depois colete um dado por vez, em conversa natural: nome, cidade, intencao morar/investir, se conhecia o La Reserva, metragem, quartos.
Antes de valores, mapeie no minimo 4 necessidades. Se pedir valores antes, responda brevemente que chega nisso em breve e continue descoberta.
Para valores, use somente dados reais dos imoveis disponiveis e da tool simulacao. Nunca invente preco, desconto, prazo, vaga ou beneficio.
Para consultor: so conduza depois de 4 necessidades, valores apresentados e interesse real. No exato momento em que o lead aceitar falar com o consultor, ative as tres tools juntas, na mesma resposta, sem esperar mais nada do lead: qualificado, aceitou_ligacao, pausar_IA. Mesmo que a mensagem ainda pergunte uma preferencia de contato (ligacao ou mensagem), as tres tools ja devem ser ativadas agora — nao adie pausar_IA para uma proxima mensagem.

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
- qualificado: apenas quando o lead aceitar falar com consultor; inclua resumo. Essa tool notifica de verdade o grupo interno da equipe — nunca mencione isso na resposta ao lead.
- aceitou_ligacao: quando aceitar contato de consultor.
- pausar_IA: quando aceitar consultor ou disser que vai verificar com alguem e retornar.
- stop: quando nao tem interesse, ja comprou, nao pode comprar, for bot/IA/empresa ou assunto impossibilitar compra. Ative IMEDIATAMENTE nesta mesma resposta, mesmo que o lead agradeca ou a conversa pareca amigavel — nao ofereca manter contato para novidades futuras nem tente reverter a objecao, apenas encerre com cordialidade.
- enviar_pdf: ativa o envio real do PDF pelo WhatsApp. Use na primeira interacao (pdf_enviado=false) e sempre que o lead pedir para receber de novo. So ative a tool, nunca diga ao lead que enviou sem ativa-la.

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

const ALICE_RESPONSE_FORMAT: OpenAI.Chat.Completions.ChatCompletionCreateParams['response_format'] = {
  type: 'json_schema',
  json_schema: {
    name: 'alice_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        reply: { type: ['string', 'null'] },
        actions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['leads', 'qualificado', 'pausar_IA', 'aceitou_ligacao', 'stop', 'enviar_pdf'],
          },
        },
        lead_updates: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: ['string', 'null'] },
            city: { type: ['string', 'null'] },
            intention: { type: ['string', 'null'], enum: ['morar', 'investir', null] },
            imovel_interesse: { type: ['string', 'null'] },
            stage: {
              type: ['string', 'null'],
              enum: [
                'nao_respondeu',
                'lead_frio',
                'lead_morno',
                'lead_quente',
                'follow_up',
                'reuniao_agendada',
                'visita_confirmada',
                'cliente',
                null,
              ],
            },
            summary: { type: ['string', 'null'] },
            automation_paused: { type: ['boolean', 'null'] },
            aceitou_consultor: { type: ['boolean', 'null'] },
          },
          required: [
            'name',
            'city',
            'intention',
            'imovel_interesse',
            'stage',
            'summary',
            'automation_paused',
            'aceitou_consultor',
          ],
        },
        internal_summary: { type: ['string', 'null'] },
      },
      required: ['reply', 'actions', 'lead_updates', 'internal_summary'],
    },
  },
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
      response_format: ALICE_RESPONSE_FORMAT,
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
      response_format: ALICE_RESPONSE_FORMAT,
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
        response_format: ALICE_RESPONSE_FORMAT,
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

  const actionsBeforePdfFallback = [...new Set([...toolState.actions, ...parsed.actions])] as AliceAction[]

  // Safety net: FLUXO B's first message must send the PDF even if the model forgot to call
  // the tool. FLUXO A (via_disparo) never auto-sends — it only reacts to an explicit request.
  const shouldForcePdf =
    !silentFailure &&
    input.lead.via_disparo !== true &&
    !input.lead.pdf_enviado &&
    !actionsBeforePdfFallback.includes('enviar_pdf')

  if (shouldForcePdf) {
    const fallbackResult = await executeAliceTool(
      { lead: input.lead, imoveis: input.imoveis, state: toolState },
      'enviar_pdf',
      {}
    )
    if (!toolState.lead_updates.pdf_enviado) {
      console.error('[alice-agent] fallback enviar_pdf call did not succeed', fallbackResult)
    }
  }

  const allActions = [...new Set([...toolState.actions, ...parsed.actions])] as AliceAction[]

  return {
    ...parsed,
    actions: allActions,
    lead_updates: {
      ...toolState.lead_updates,
      ...parsed.lead_updates,
      // Tool calls are ground truth: never let the model's own JSON contradict an action it just fired.
      ...((allActions.includes('pausar_IA') || allActions.includes('stop')) ? { automation_paused: true } : {}),
      ...(allActions.includes('aceitou_ligacao') ? { aceitou_consultor: true } : {}),
      ...(toolState.lead_updates.pdf_enviado ? { pdf_enviado: true } : {}),
    },
  }
}
