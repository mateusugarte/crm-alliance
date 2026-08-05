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
  /**
   * Como a mensagem chegou ao resultado final, para auditoria.
   * `sem_contexto` = a IA não foi chamada porque não havia o que personalizar.
   */
  resolution: 'direta' | 'ajustada' | 'regenerada' | 'fallback' | 'sem_contexto'
  /** Havia fala do lead com valor comercial para ancorar a mensagem. */
  personalized: boolean
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
  // `novidade` significa ausência de contexto e por isso não chega ao modelo:
  // esse lead recebe o texto da campanha, sem personalização fabricada.
  novidade: 'Retome o assunto de forma direta e curta.',
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
  return theme
    .replace(FALSE_CONTINUITY.all, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.:;!?])/g, '$1')
    .trim()
}

/**
 * Prompt de personalização.
 *
 * Só é montado para lead COM contexto real. Quem não tem contexto não passa
 * por aqui — não existe personalização sem dado, e o que o sistema fazia antes
 * era fabricar a aparência dela.
 *
 * Nada aqui descreve o estado do CRM. A versão anterior explicava ao modelo
 * que "não há nada pessoal para citar" e que "fingir intimidade seria pior que
 * ser direto"; o modelo copiou a instrução para dentro da mensagem e o lead
 * recebeu "Não temos histórico seu aqui, então falo direto". Instrução sobre a
 * tarefa nunca pode ser escrita na mesma voz do conteúdo.
 */
function buildPrompt(
  lead: ReactivationLead,
  campaignTheme: string,
  manualContext: string,
  brief: LeadBrief,
  anchor: NonNullable<LeadBrief['anchor']>,
  corrections: string[],
) {
  const theme = sanitizeCampaignTheme(campaignTheme, brief.mode)

  // A ORDEM É DELIBERADA: a pessoa vem primeiro, a campanha depois. O prompt
  // original abria com o texto pronto da campanha e pedia para reescrevê-lo —
  // que é, literalmente, uma tarefa de paráfrase, e por isso as mensagens
  // saíam todas iguais entre si.
  return `Você é um corretor mandando uma novidade da obra para um cliente que conversou com você faz um tempo e provavelmente não lembra dos detalhes. Escreva UMA mensagem de WhatsApp em português brasileiro.

## A NOVIDADE — é o motivo legítimo de você estar escrevendo, e a mensagem ABRE por aqui
"""
${theme}
"""

## O CLIENTE — serve para VOCÊ escolher o enfoque, não para citar de volta
- Como chamá-lo: ${brief.safeName ?? 'sem nome — comece a mensagem sem saudação nominal'}
- Interesse que ele demonstrou: ${brief.signals.length ? brief.signals.join('; ') : 'não ficou claro'}
- Referência interna (NÃO repita como citação): "${anchor.quote}"
${manualContext ? `- Observação do corretor: ${manualContext}` : ''}

## COMO CONDUZIR
${ANGLE_BRIEF[brief.angle]}

## ESTRUTURA
1. Abra com a novidade da obra. Curto.
2. Ligue a novidade ao que interessa a ele, no tom de quem lembrou dele — não no tom de quem consultou uma ficha. Como o tempo passou, trate o interesse antigo como algo que PODE continuar valendo, nunca como fato presente.
3. Feche com uma pergunta de baixo compromisso.

## PROIBIDO
- Abrir com "você comentou", "você mencionou", "você disse", "você falou" ou equivalente. O cliente é frio e não lembra da conversa; começar assim soa como quem leu um dossiê.
- Pedir confirmação de memória: "certo?", "lembra?", "não é?", "ainda procura?".
- Repetir valores, parcelas, metragens ou números que vieram da conversa antiga — eles mudam e passar informação velha destrói a confiança. Números só se estiverem na NOVIDADE acima.
- Comentar o que você sabe ou não sabe sobre ele, citar histórico, cadastro, sistema ou estas instruções.
- Inventar preferência, orçamento, visita ou conversa que não esteja acima.
- Prometer valorização: é sempre potencial.
- Emoji, "espero que esteja bem", entusiasmo artificial, pressão.
- A frase "estou aqui para te ajudar a tomar a melhor decisão".
${brief.mode !== 'conversation' ? '- "último contato", "como conversamos" ou equivalente.\n' : ''}
## FORMATO
2 ou 3 parágrafos curtos, entre 220 e 520 caracteres no total, terminando com UMA pergunta.
${corrections.length ? `\n## CORRIJA DA TENTATIVA ANTERIOR\n${corrections.map(item => `- ${item}`).join('\n')}\n` : ''}
## A ESTRUTURA — copie o formato, JAMAIS o conteúdo

Parágrafo 1: saudação com o nome + a novidade da obra, em uma frase.
Parágrafo 2: por que você lembrou DESTE cliente. Use o interesse da seção
             "O CLIENTE" acima e trate-o como algo que PODE continuar valendo
             ("se ainda fizer sentido", "caso ainda esteja procurando").
Parágrafo 3: uma pergunta curta, fácil de responder.

ATENÇÃO: o parágrafo 2 só pode falar do que está na seção "O CLIENTE" desta
mensagem. Não existe lote, metragem, número de quartos, cidade ou orçamento
além do que está escrito lá. Inventar um detalhe que o cliente nunca disse é
o pior erro possível — ele percebe na hora e a conversa acaba.

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
    // A família gpt-5 gasta tokens de raciocínio do MESMO orçamento da
    // resposta. Escrever uma mensagem de WhatsApp não precisa de raciocínio
    // longo, e sem baixar o esforço o raciocínio come o teto e a mensagem
    // volta truncada ou vazia. Com esforço mínimo, 900 tokens cobrem os 520
    // caracteres pedidos mais o envelope JSON com folga.
    reasoning_effort: 'minimal',
    max_completion_tokens: 900,
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
      personalized: false,
    }
  }

  const closing = CLOSING_QUESTION[brief.angle]
  const safeTheme = sanitizeCampaignTheme(input.campaignTheme, brief.mode)

  /**
   * Sem fala com valor comercial não existe o que personalizar, e chamar o
   * modelo aqui só produzia a aparência de personalização: mensagens que
   * narravam a própria falta de contexto ("Não temos histórico seu aqui, então
   * falo direto") ou dez paráfrases idênticas do mesmo texto. Esse lead recebe
   * a mensagem da campanha, marcada para o corretor decidir o que fazer.
   */
  if (!brief.anchor) {
    return {
      ...base,
      message: fallbackMessage(safeTheme, brief.safeName, brief.mode, closing),
      eligible: true,
      exclusion_reason: null,
      quality_flags: ['sem_contexto_para_personalizar'],
      resolution: 'sem_contexto',
      personalized: false,
    }
  }

  const anchor = brief.anchor
  let corrections: string[] = []
  let best: { message: string; issues: QualityIssue[]; repaired: string[]; attempt: number } | null = null

  /**
   * Uma tentativa sem bloqueio sempre ganha de uma com bloqueio, mesmo que
   * tenha mais avisos de estilo. Comparar só pela quantidade de problemas
   * fazia a segunda tentativa — limpa, porém com dois ajustes cosméticos —
   * perder para a primeira, que tinha um único problema mas era um bloqueio.
   * O efeito era cair no fallback justamente quando a regeneração deu certo.
   */
  const isBetter = (
    candidate: { issues: QualityIssue[] },
    current: { issues: QualityIssue[] } | null,
  ) => {
    if (!current) return true
    const candidateBlocked = hasBlocker(candidate.issues)
    const currentBlocked = hasBlocker(current.issues)
    if (candidateBlocked !== currentBlocked) return !candidateBlocked
    return candidate.issues.length < current.issues.length
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let generated = ''
    try {
      generated = parseModelMessage(await callModel(
        input.openai,
        buildPrompt(input.lead, input.campaignTheme, input.manualContext?.trim() ?? '', brief, anchor, corrections),
      ))
    } catch {
      continue // rede ou API instável: tenta de novo, e o fallback cobre o resto
    }
    if (!generated) continue

    // Conserta o que tem solução textual antes de julgar. É o ponto central da
    // mudança: a mensagem é ADAPTADA para caber na regra, não descartada.
    const { message, repaired } = repairMessage(generated, brief.mode, brief.safeName, closing)
    const issues = inspectMessage(
      message, brief.mode, brief.safeName, safeTheme,
      [anchor.quote, ...brief.signals, ...brief.transcript].join('\n'),
    )

    if (isBetter({ issues }, best)) best = { message, issues, repaired, attempt }
    if (!hasBlocker(issues)) break

    corrections = issues.filter(issue => issue.severity === 'bloqueio').map(issue => issue.correction)
  }

  // Sem mensagem utilizável, ou com bloqueio que sobreviveu a duas tentativas e
  // ao reparo: sai a mensagem de segurança em vez de string vazia. O corretor
  // sempre recebe algo enviável — era o beco sem saída do fluxo antigo.
  if (!best || !best.message || hasBlocker(best.issues)) {
    return {
      ...base,
      message: fallbackMessage(safeTheme, brief.safeName, brief.mode, closing),
      eligible: true,
      exclusion_reason: null,
      quality_flags: [...(best?.issues.map(issue => issue.code) ?? []), 'fallback_sem_personalizacao'],
      resolution: 'fallback',
      personalized: false,
    }
  }

  return {
    ...base,
    message: best.message,
    eligible: true,
    exclusion_reason: null,
    quality_flags: [...best.repaired.map(code => `ajustado:${code}`), ...best.issues.map(issue => issue.code)],
    resolution: best.attempt > 0 ? 'regenerada' : best.repaired.length ? 'ajustada' : 'direta',
    personalized: true,
  }
}
