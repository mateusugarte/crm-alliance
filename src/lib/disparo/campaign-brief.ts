import { FALSE_CONTINUITY } from './message-quality'

export const CAMPAIGN_BRIEF_VERSION = 'campaign-brief-v1'

export interface CampaignFact {
  id: string
  value: string
  source: 'campaign_theme'
}

export interface CampaignBrief {
  version: typeof CAMPAIGN_BRIEF_VERSION
  objective: string
  novelty: string
  current_facts: CampaignFact[]
  cta: string
  tone: string[]
  prohibited_claims: string[]
  normalized_theme: string
}

const BANNED_DECISION_PHRASE = /estou aqui (?:para|pra) te ajudar a tomar a melhor decis[aã]o/gi
const PRESSURE = /\b(?:corra|aproveite antes que acabe|última chance|imperdível)\b/gi
const RETURN_PROMISE = /\b(?:pega|ter[aá]|garante)\s+(?:uma\s+)?valoriza[cç][aã]o\s+(?:interessante|alta|forte|garantida)\b/gi

function tidy(value: string) {
  return value
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([,.:;!?])/g, '$1')
    .replace(/\s+([.!?])/g, '$1')
    .replace(/^[,;: \t-]+/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeCampaignTheme(theme: string) {
  return tidy(theme
    .replace(FALSE_CONTINUITY.all, '')
    .replace(BANNED_DECISION_PHRASE, 'fico à disposição para tirar suas dúvidas')
    .replace(RETURN_PROMISE, 'pode acompanhar o potencial de valorização')
    .replace(PRESSURE, '')
  )
}

function splitSentences(value: string) {
  return value
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(sentence => tidy(sentence))
    .filter(Boolean)
}

function campaignFact(value: string) {
  const afterColon = value.match(/^estou (?:te|lhe) mandando (?:essa )?mensagem\b[^:]*:\s*(.+)$/i)?.[1]
  return tidy(afterColon ?? value)
}

function stripClosingQuestion(value: string) {
  return tidy(value.replace(/[^.!?]*\?\s*$/u, ''))
}

export function buildCampaignBrief(theme: string): CampaignBrief {
  const normalized = normalizeCampaignTheme(theme)
  const sentences = splitSentences(normalized)
  const closingQuestion = [...sentences].reverse().find(sentence => sentence.includes('?'))
  const statements = sentences
    .filter(sentence => !sentence.includes('?'))
    .map(sentence => campaignFact(sentence).replace(/[.!]+$/g, '').trim())
    .filter(Boolean)
    .slice(0, 3)

  const fallbackStatement = stripClosingQuestion(normalized).replace(/[.!]+$/g, '').trim()
  const facts = (statements.length ? statements : [fallbackStatement])
    .filter(Boolean)
    .map((value, index) => ({ id: `campaign-${index + 1}`, value, source: 'campaign_theme' as const }))

  return {
    version: CAMPAIGN_BRIEF_VERSION,
    objective: 'Reativar o interesse no La Reserva a partir de uma novidade atual e verificável.',
    novelty: facts.map(fact => fact.value).join('. '),
    current_facts: facts,
    cta: closingQuestion?.trim() || 'O projeto ainda faz sentido para você?',
    tone: ['humano', 'consultivo', 'objetivo', 'sem pressão'],
    prohibited_claims: [
      'promessa de valorização',
      'estado interno do CRM',
      'preço, prazo ou disponibilidade fora do briefing',
      'detalhe pessoal sem fonte',
    ],
    normalized_theme: normalized,
  }
}

function greeting(name: string | null) {
  return name ? `Oi, ${name}!` : 'Olá!'
}

export function renderCampaignOnlyMessage(
  brief: CampaignBrief,
  safeName: string | null,
  variant: number,
) {
  const novelty = brief.novelty.replace(/[.!?]+$/g, '').trim()
  const cta = brief.cta.endsWith('?') ? brief.cta : `${brief.cta.replace(/[.!]+$/g, '')}?`
  const openings = [
    `${greeting(safeName)} Passando para compartilhar uma atualização do La Reserva:`,
    `${greeting(safeName)} Tenho uma novidade sobre o La Reserva:`,
    `${greeting(safeName)} Uma atualização importante do La Reserva:`,
    `${greeting(safeName)} Passando com uma novidade da obra do La Reserva:`,
    `${greeting(safeName)} Queria te atualizar sobre o La Reserva:`,
  ]
  return tidy(`${openings[Math.abs(variant) % openings.length]} ${novelty}.\n\n${cta}`)
}
