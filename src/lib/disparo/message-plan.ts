import type { CampaignBrief } from './campaign-brief'
import type { CommercialFact, LeadAngle, LeadBrief } from './lead-brief'

export const MESSAGE_PLAN_VERSION = 'message-plan-v1'

export interface MessagePlan {
  version: typeof MESSAGE_PLAN_VERSION
  opening: 'campaign_novelty'
  angle: LeadAngle
  personalization_fact_ids: string[]
  personalization_facts: string[]
  cta: string
  variant: number
  must_not_mention: string[]
}

const CTA_BY_ANGLE: Record<LeadAngle, string> = {
  objecao: 'Faz sentido eu te procurar mais para frente?',
  consultor: 'Quer que eu organize uma conversa com o consultor?',
  financiamento: 'Quer que eu te mande as condições atualizadas?',
  unidade: 'Quer que eu te mostre as opções disponíveis hoje?',
  prazo: 'Quer que eu te passe a atualização da obra?',
  novidade: 'O projeto ainda faz sentido para você?',
}

function stableVariant(leadId: string) {
  let hash = 0
  for (const char of leadId) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return Math.abs(hash) % 5
}

function chooseFacts(facts: CommercialFact[]) {
  return facts
    .filter(fact => fact.safe_for_copy)
    .sort((a, b) => b.score - a.score)
    .filter((fact, index, all) => all.findIndex(other => other.value === fact.value) === index)
    .slice(0, 2)
}

export function buildMessagePlan(leadId: string, brief: LeadBrief, campaign: CampaignBrief): MessagePlan {
  const selected = chooseFacts(brief.facts)
  return {
    version: MESSAGE_PLAN_VERSION,
    opening: 'campaign_novelty',
    angle: selected[0]?.angle ?? brief.angle,
    personalization_fact_ids: selected.map(fact => fact.id),
    personalization_facts: selected.map(fact => fact.value),
    cta: selected.length ? CTA_BY_ANGLE[selected[0]?.angle ?? brief.angle] : campaign.cta,
    variant: stableVariant(leadId),
    must_not_mention: [
      'histórico, cadastro, ficha, sistema ou banco de dados',
      'fala literal do cliente',
      'valor ou prazo antigo',
      'qualquer detalhe fora dos fatos permitidos',
    ],
  }
}
