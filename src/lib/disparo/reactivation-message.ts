import type OpenAI from 'openai'
import {
  buildLeadBrief,
  type AudienceAssessment,
  type BriefInteraction,
  type BriefLead,
  type CommercialFact,
  type ContextMode,
  type LeadBrief,
} from './lead-brief'
import {
  buildCampaignBrief,
  normalizeCampaignTheme,
  renderCampaignOnlyMessage,
  type CampaignBrief,
} from './campaign-brief'
import { buildMessagePlan, type MessagePlan } from './message-plan'
import {
  hasBlocker,
  inspectMessage,
  repairMessage,
  type QualityIssue,
} from './message-quality'

export type ReactivationLead = BriefLead
export type ReactivationInteraction = BriefInteraction
export type ReactivationContextMode = ContextMode
export type ApprovalStatus = 'ready' | 'review' | 'blocked'

export type ReactivationGeneration = {
  lead_id: string
  name: string
  phone: string
  message: string
  eligible: boolean
  exclusion_reason: string | null
  context_mode: ReactivationContextMode
  context_reference: string | null
  context_summary: string
  safe_name: string | null
  audience: AudienceAssessment
  facts: CommercialFact[]
  campaign_brief: CampaignBrief
  message_plan: MessagePlan
  quality_flags: string[]
  resolution: 'direta' | 'ajustada' | 'regenerada' | 'fallback' | 'sem_contexto'
  personalized: boolean
  approval_status: ApprovalStatus
  model: string | null
  prompt_version: 'reactivation-v3'
}

const MODEL = 'gpt-5-mini'
const PROMPT_VERSION = 'reactivation-v3' as const

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

interface ModelOutput {
  message: string
  used_fact_ids: string[]
}

function parseModelOutput(value: string): ModelOutput {
  const raw = value.trim()
  try {
    const parsed = JSON.parse(raw) as { message?: unknown; used_fact_ids?: unknown }
    return {
      message: typeof parsed.message === 'string' ? sanitizeMessage(parsed.message) : '',
      used_fact_ids: Array.isArray(parsed.used_fact_ids)
        ? parsed.used_fact_ids.filter((id): id is string => typeof id === 'string')
        : [],
    }
  } catch {
    const salvaged = /"message"\s*:\s*"((?:[^"\\]|\\.)*)/.exec(raw)
    if (salvaged?.[1]) {
      try {
        return { message: sanitizeMessage(JSON.parse(`"${salvaged[1]}"`) as string), used_fact_ids: [] }
      } catch { /* resposta inválida; o fallback cobre */ }
    }
  }
  return { message: '', used_fact_ids: [] }
}

/** Mantido como API pública para os testes e consumidores existentes. */
export function sanitizeCampaignTheme(theme: string, mode?: ContextMode) {
  void mode
  return normalizeCampaignTheme(theme)
}

function summarizeContext(brief: LeadBrief) {
  if (brief.audience.status === 'blocked') return brief.audience.reasons[0] ?? 'Contato bloqueado.'
  const safeFacts = brief.facts.filter(fact => fact.safe_for_copy).slice(0, 3)
  if (!safeFacts.length) {
    return brief.audience.status === 'review'
      ? 'Sem evidência comercial suficiente. Revise o contato antes de aprovar.'
      : 'Entrou pelo fluxo do empreendimento, mas não deixou preferência comercial específica.'
  }
  return safeFacts.map(fact => fact.value).join('; ')
}

function buildPrompt(campaign: CampaignBrief, brief: LeadBrief, plan: MessagePlan, corrections: string[]) {
  const facts = brief.facts
    .filter(fact => plan.personalization_fact_ids.includes(fact.id))
    .map(fact => ({ id: fact.id, kind: fact.kind, value: fact.value }))

  return `Escreva UMA mensagem de reativação do empreendimento La Reserva para WhatsApp, em português brasileiro.

BRIEFING ATUAL DA CAMPANHA
${JSON.stringify({
    objective: campaign.objective,
    current_facts: campaign.current_facts,
    tone: campaign.tone,
    prohibited_claims: campaign.prohibited_claims,
  })}

PLANO APROVADO PARA ESTA MENSAGEM
${JSON.stringify({
    safe_name: brief.safeName,
    opening: plan.opening,
    angle: plan.angle,
    permitted_customer_facts: facts,
    cta: plan.cta,
    variant: plan.variant,
    must_not_mention: plan.must_not_mention,
  })}

REGRAS OBRIGATÓRIAS
- Abra pela novidade atual da campanha.
- Personalize somente com os rótulos em permitted_customer_facts. Não acrescente detalhes.
- Trate qualquer interesse anterior como possibilidade atual, nunca como certeza.
- Não mencione histórico, cadastro, ficha, sistema, banco de dados ou falta de informação.
- Não invente localização, prazo, preço, unidade, metragem, disponibilidade, conversa ou preferência.
- Não qualifique condições como flexíveis, melhores, especiais ou vantajosas sem fonte atual.
- Não repita números antigos nem faça promessa de valorização.
- Não cobre memória ou resposta. Sem emoji, pressão ou entusiasmo artificial.
- Faça a oferta uma única vez. Não diga "posso enviar" e depois repita "quer que eu envie?".
- Produza 2 ou 3 parágrafos curtos, entre 180 e 520 caracteres, e termine com uma única pergunta.
- Varie a construção conforme variant=${plan.variant}; não copie uma fórmula fixa.
${corrections.length ? `- Corrija também: ${corrections.join('; ')}.` : ''}

Responda em JSON válido: {"message":"texto final","used_fact_ids":["id dos fatos efetivamente usados"]}`
}

export function analyzeReactivationContext(lead: ReactivationLead, interactions: ReactivationInteraction[]) {
  const brief = buildLeadBrief(lead, interactions)
  return {
    eligible: brief.eligible,
    exclusionReason: brief.exclusionReason,
    mode: brief.mode,
    reference: brief.anchor?.quote ?? null,
    safeName: brief.safeName,
    angle: brief.angle,
    signals: brief.signals,
    audience: brief.audience,
    facts: brief.facts,
  }
}

async function callModel(openai: OpenAI, prompt: string) {
  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: 'system',
        content: 'Você é um corretor experiente. Escreve de forma curta, humana e específica, usando somente os fatos estruturados autorizados. Responde sempre no JSON pedido.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
    reasoning_effort: 'minimal',
    max_completion_tokens: 900,
  })
  return completion.choices[0]?.message?.content ?? ''
}

function deterministicResult(
  base: Omit<ReactivationGeneration, 'message' | 'quality_flags' | 'resolution' | 'personalized' | 'approval_status' | 'model'>,
  campaign: CampaignBrief,
  brief: LeadBrief,
  plan: MessagePlan,
): ReactivationGeneration {
  const unknown = brief.audience.status === 'review'
  return {
    ...base,
    message: renderCampaignOnlyMessage(campaign, brief.safeName, plan.variant),
    quality_flags: [unknown ? 'publico_desconhecido_requer_aprovacao' : 'sem_contexto_para_personalizar'],
    resolution: 'sem_contexto',
    personalized: false,
    approval_status: unknown ? 'review' : 'ready',
    model: null,
  }
}

export async function generateReactivationMessage(input: {
  openai: OpenAI
  lead: ReactivationLead
  interactions: ReactivationInteraction[]
  campaignTheme: string
  campaignBrief?: CampaignBrief
  /** Compatibilidade temporária: conteúdo livre não entra mais no prompt. */
  manualContext?: string
}): Promise<ReactivationGeneration> {
  const brief = buildLeadBrief(input.lead, input.interactions)
  const campaign = input.campaignBrief ?? buildCampaignBrief(input.campaignTheme)
  const plan = buildMessagePlan(input.lead.id, brief, campaign)
  const base = {
    lead_id: input.lead.id,
    name: input.lead.name ?? '',
    phone: input.lead.phone ?? '',
    eligible: brief.audience.status !== 'blocked',
    exclusion_reason: brief.exclusionReason,
    context_mode: brief.mode,
    context_reference: null,
    context_summary: summarizeContext(brief),
    safe_name: brief.safeName,
    audience: brief.audience,
    facts: brief.facts,
    campaign_brief: campaign,
    message_plan: plan,
    prompt_version: PROMPT_VERSION,
  }

  if (brief.audience.status === 'blocked') {
    return {
      ...base,
      message: '',
      quality_flags: ['lead_incompativel_com_reativacao'],
      resolution: 'direta',
      personalized: false,
      approval_status: 'blocked',
      model: null,
    }
  }

  if (!plan.personalization_fact_ids.length || brief.audience.status === 'review') {
    return deterministicResult(base, campaign, brief, plan)
  }

  const permittedIds = new Set(plan.personalization_fact_ids)
  const auditableFactIds = new Set([
    ...plan.personalization_fact_ids,
    ...campaign.current_facts.map(fact => fact.id),
  ])
  const grounding = [
    ...campaign.current_facts.map(fact => fact.value),
    ...brief.facts.filter(fact => permittedIds.has(fact.id)).map(fact => fact.value),
  ].join('\n')
  let corrections: string[] = []
  let best: { message: string; issues: QualityIssue[]; repaired: string[]; attempt: number } | null = null

  const isBetter = (candidate: { issues: QualityIssue[] }, current: { issues: QualityIssue[] } | null) => {
    if (!current) return true
    const candidateBlocked = hasBlocker(candidate.issues)
    const currentBlocked = hasBlocker(current.issues)
    if (candidateBlocked !== currentBlocked) return !candidateBlocked
    return candidate.issues.length < current.issues.length
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let output: ModelOutput
    try {
      output = parseModelOutput(await callModel(input.openai, buildPrompt(campaign, brief, plan, corrections)))
    } catch {
      continue
    }
    if (!output.message) continue

    const invalidFactIds = output.used_fact_ids.filter(id => !auditableFactIds.has(id))
    const { message, repaired } = repairMessage(output.message, brief.mode, brief.safeName, plan.cta)
    const issues = inspectMessage(message, brief.mode, brief.safeName, campaign.normalized_theme, grounding)
    if (invalidFactIds.length) {
      issues.push({
        code: 'fato_fora_do_plano',
        severity: 'ajuste',
        correction: 'retorne somente os IDs de fatos autorizados no plano',
      })
    }

    if (isBetter({ issues }, best)) best = { message, issues, repaired, attempt }
    if (!hasBlocker(issues)) break
    corrections = issues.filter(issue => issue.severity === 'bloqueio').map(issue => issue.correction)
  }

  if (!best || !best.message || hasBlocker(best.issues)) {
    return {
      ...base,
      message: renderCampaignOnlyMessage(campaign, brief.safeName, plan.variant),
      quality_flags: [...(best?.issues.map(issue => issue.code) ?? []), 'fallback_sem_personalizacao'],
      resolution: 'fallback',
      personalized: false,
      approval_status: 'review',
      model: MODEL,
    }
  }

  return {
    ...base,
    message: best.message,
    quality_flags: [...best.repaired.map(code => `ajustado:${code}`), ...best.issues.map(issue => issue.code)],
    resolution: best.attempt > 0 ? 'regenerada' : best.repaired.length ? 'ajustada' : 'direta',
    personalized: true,
    approval_status: 'ready',
    model: MODEL,
  }
}
