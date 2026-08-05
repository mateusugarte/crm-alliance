import type OpenAI from 'openai'
import {
  buildLeadBrief,
  type BriefInteraction,
  type BriefLead,
  type ContextMode,
  type LeadAngle,
  type LeadBrief,
} from './lead-brief'
import {
  FALSE_CONTINUITY,
  fallbackMessage,
  hasBlocker,
  inspectMessage,
  repairMessage,
  type QualityIssue,
} from './message-quality'

export type ReactivationLead = BriefLead
export type ReactivationInteraction = BriefInteraction
export type ReactivationContextMode = ContextMode

export type ReactivationGeneration = {
  lead_id: string
  name: string
  phone: string
  message: string
  eligible: boolean
  exclusion_reason: string | null
  context_mode: ReactivationContextMode
  context_reference: string | null
  quality_flags: string[]
  /** Como a mensagem chegou ao resultado final, para auditoria. */
  resolution: 'direta' | 'ajustada' | 'regenerada' | 'fallback'
}

/** Modelo da geração. Custo desprezível na escala do projeto (a base inteira
 *  sai por menos de US$ 1), então a escolha é por qualidade de escrita. */
const MODEL = 'gpt-5-mini'

/**
 * Perguntas de fechamento por ângulo.
 *
 * Existem em código porque são também o conserto determinístico quando o
 * modelo esquece a pergunta final — assim o reparo não inventa contexto.
 */
const CLOSING_QUESTION: Record<LeadAngle, string> = {
  objecao: 'Faz sentido eu te procurar mais pra frente?',
  consultor: 'Quer que eu agende essa conversa?',
  financiamento: 'Quer que eu te mande os valores atualizados?',
  unidade: 'Ainda faz sentido pra você?',
  prazo: 'Quer que eu te passe o cronograma atualizado?',
  novidade: 'O projeto ainda faz sentido pra você?',
}

/** O que fazer com cada ângulo — instrução concreta, não estilo genérico. */
const ANGLE_BRIEF: Record<LeadAngle, string> = {
  objecao: 'Reconheça a objeção ou o adiamento ANTES de qualquer oferta. Não insista; ofereça retomar quando fizer sentido.',
  consultor: 'O lead pediu atendimento humano e não foi atendido. Assuma isso com naturalidade e ofereça marcar a conversa.',
  financiamento: 'Puxe pelo lado da condição de pagamento, que é o que ele perguntou. Não cite números que não estão no histórico.',
  unidade: 'Ancore na unidade ou característica concreta que ele estava avaliando.',
  prazo: 'Responda ao que ele perguntou sobre prazo, usando o avanço da obra como resposta.',
  novidade: 'Não há contexto para personalizar. Apresente a atualização da obra como novidade, de forma direta e curta.',
}

function sanitizeMessage(value: string) {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^['"“]|['"”]$/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseModelMessage(value: string) {
  const raw = value.trim()
  try {
    const parsed = JSON.parse(raw) as { message?: unknown }
    if (typeof parsed.message === 'string') return sanitizeMessage(parsed.message)
  } catch {
    // JSON truncado quando a resposta bate no teto de tokens. Resgata o campo
    // `message` a mão em vez de devolver o JSON quebrado como se fosse texto —
    // era assim que chaves e aspas vazavam para a mensagem do lead.
    const salvaged = /"message"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(raw)
    if (salvaged?.[1]) {
      try { return sanitizeMessage(JSON.parse(`"${salvaged[1]}"`) as string) } catch { /* segue */ }
    }
  }
  return sanitizeMessage(raw)
}

/**
 * Remove do tema as frases que fingem contato anterior, quando o lead não teve
 * contato. É a correção da causa raiz: o texto-base do corretor costuma abrir
 * com "desde o nosso último contato", que é exatamente a frase que o gate
 * proíbe. O modelo copiava a abertura do tema, tropeçava na própria regra e a
 * mensagem era descartada. Agora a frase nunca chega ao modelo.
 */
export function sanitizeCampaignTheme(theme: string, mode: ContextMode) {
  if (mode === 'conversation') return theme.trim()
  const cleaned = theme.replace(FALSE_CONTINUITY, '')
  FALSE_CONTINUITY.lastIndex = 0
  return cleaned.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.:;!?])/g, '$1').trim()
}

function buildPrompt(
  lead: ReactivationLead,
  campaignTheme: string,
  manualContext: string,
  brief: LeadBrief,
  corrections: string[],
) {
  const theme = sanitizeCampaignTheme(campaignTheme, brief.mode)

  // A ORDEM É DELIBERADA: a pessoa vem primeiro, a campanha depois.
  // O prompt anterior abria com o texto pronto da campanha e pedia para
  // reescrevê-lo — o que é, literalmente, uma tarefa de paráfrase. Por isso
  // todas as mensagens saíam iguais entre si. Aqui a tarefa é escrever PARA
  // alguém, e os fatos da campanha são só o assunto.
  const person = brief.anchor
    ? [
      `Ele mesmo escreveu: "${brief.anchor.quote}"`,
      brief.signals.length ? `O que sabemos dele: ${brief.signals.join('; ')}.` : '',
      `ANCORE A MENSAGEM NESSA FALA. É a informação mais valiosa da conversa — não é a mais recente, é a que mais importa comercialmente.`,
    ].filter(Boolean).join('\n')
    : brief.mode === 'sparse'
      ? 'Ele só respondeu a uma mensagem automática de anúncio. Não há nada pessoal para citar, e fingir intimidade seria pior que ser direto.'
      : 'Ele nunca respondeu. É um primeiro contato de verdade.'

  return `Escreva UMA mensagem de WhatsApp para a pessoa abaixo. Português brasileiro, tom de corretor experiente que conhece o cliente.

## A PESSOA
- Como chamá-la: ${brief.safeName ?? 'não use nome — o cadastro não tem um nome de pessoa confiável'}
- Etapa no funil: ${lead.stage ?? 'não informada'}
${person}
${manualContext ? `- Observação do corretor: ${manualContext}` : ''}

## O QUE FAZER NESTA MENSAGEM
${ANGLE_BRIEF[brief.angle]}

## O ASSUNTO (fatos reais da campanha — use como informação, não como texto a copiar)
"""
${theme}
"""

## HISTÓRICO RECENTE
${brief.transcript.length ? brief.transcript.join('\n') : '(sem histórico)'}

## REGRAS
- 2 ou 3 parágrafos curtos, entre 220 e 520 caracteres no total.
- Termine com UMA pergunta simples de responder.
- Só use fatos que estão acima. Nunca invente preferência, orçamento, visita ou conversa.
- Valorização é sempre potencial, nunca promessa ou garantia.
- Sem emoji, sem "espero que esteja bem", sem entusiasmo artificial, sem pressão.
- Não escreva "estou aqui para te ajudar a tomar a melhor decisão".
${brief.mode !== 'conversation' ? '- Este lead NÃO conversou com a gente antes. Não escreva "último contato", "como conversamos" nem equivalente.\n' : ''}${corrections.length ? `\n## CORRIJA DA TENTATIVA ANTERIOR\n${corrections.map(item => `- ${item}`).join('\n')}\n` : ''}
## EXEMPLO DO PADRÃO ESPERADO
Contexto: o lead disse "possuo um lote avaliado em R$ 125.000" e buscava 2 quartos.
Mensagem: "Oi, Ana! Você comentou que tinha um lote avaliado em R$ 125 mil e buscava um 2 quartos — isso cobre boa parte da entrada do Apto 02.

A obra avançou desde então: a fundação está concluída e em breve subimos os andares. Quem entra nesta fase acompanha o potencial de valorização até a entrega.

Quer que eu refaça a conta com o valor do lote?"

Repare: a mensagem começa pelo que É DELE, não pela obra. Faça o mesmo.

Responda em JSON válido: {"message":"texto final"}`
}

export function analyzeReactivationContext(
  lead: ReactivationLead,
  interactions: ReactivationInteraction[],
) {
  const brief = buildLeadBrief(lead, interactions)
  return {
    eligible: brief.eligible,
    exclusionReason: brief.exclusionReason,
    mode: brief.mode,
    reference: brief.anchor?.quote ?? null,
    safeName: brief.safeName,
    angle: brief.angle,
    signals: brief.signals,
  }
}

async function callModel(
  openai: OpenAI,
  prompt: string,
): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Você é um corretor de imóveis experiente escrevendo no WhatsApp. Escreve curto, humano e específico. Nunca inventa fatos sobre o cliente. Responde sempre no JSON pedido.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    // Folga suficiente para 520 caracteres + envelope JSON sem truncar.
    max_completion_tokens: 700,
  })
  return completion.choices[0]?.message?.content ?? ''
}

export async function generateReactivationMessage(input: {
  openai: OpenAI
  lead: ReactivationLead
  interactions: ReactivationInteraction[]
  campaignTheme: string
  manualContext?: string
}): Promise<ReactivationGeneration> {
  const brief = buildLeadBrief(input.lead, input.interactions)
  const base = {
    lead_id: input.lead.id,
    name: input.lead.name ?? '',
    phone: input.lead.phone ?? '',
    context_mode: brief.mode,
    context_reference: brief.anchor?.quote ?? null,
  }

  if (!brief.eligible) {
    return {
      ...base,
      message: '',
      eligible: false,
      exclusion_reason: brief.exclusionReason,
      quality_flags: ['lead_incompativel_com_reativacao'],
      resolution: 'direta',
    }
  }

  const closing = CLOSING_QUESTION[brief.angle]
  let corrections: string[] = []
  let best: { message: string; issues: QualityIssue[]; repaired: string[] } | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await callModel(
      input.openai,
      buildPrompt(input.lead, input.campaignTheme, input.manualContext?.trim() ?? '', brief, corrections),
    )
    const generated = parseModelMessage(raw)

    // Conserta o que tem solução textual antes de julgar. É o ponto central da
    // mudança: a mensagem é ADAPTADA para caber na regra, não descartada.
    const { message, repaired } = repairMessage(generated, brief.mode, brief.safeName, closing)
    const issues = inspectMessage(message, brief.mode, brief.safeName)

    if (!best || issues.length < best.issues.length) best = { message, issues, repaired }
    if (!hasBlocker(issues)) break

    corrections = issues.filter(issue => issue.severity === 'bloqueio').map(issue => issue.correction)
  }

  if (!best || !best.message) {
    return {
      ...base,
      message: fallbackMessage(sanitizeCampaignTheme(input.campaignTheme, brief.mode), brief.safeName),
      eligible: true,
      exclusion_reason: null,
      quality_flags: ['fallback_sem_personalizacao'],
      resolution: 'fallback',
    }
  }

  // Bloqueio que sobreviveu a duas tentativas e ao reparo: manda a mensagem de
  // segurança em vez de string vazia. O corretor sempre recebe algo enviável.
  if (hasBlocker(best.issues)) {
    return {
      ...base,
      message: fallbackMessage(sanitizeCampaignTheme(input.campaignTheme, brief.mode), brief.safeName),
      eligible: true,
      exclusion_reason: null,
      quality_flags: [...best.issues.map(issue => issue.code), 'fallback_sem_personalizacao'],
      resolution: 'fallback',
    }
  }

  return {
    ...base,
    message: best.message,
    eligible: true,
    exclusion_reason: null,
    quality_flags: [...best.repaired.map(code => `ajustado:${code}`), ...best.issues.map(issue => issue.code)],
    resolution: best.repaired.length ? 'ajustada' : 'direta',
  }
}
