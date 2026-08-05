import { describe, expect, it } from 'vitest'
import { buildCampaignBrief, renderCampaignOnlyMessage } from './campaign-brief'

const THEME = `As obras avançaram desde o nosso último contato: a fundação está praticamente concluída.

Quem entra agora ainda pega uma valorização interessante até o fim da obra, e estou aqui pra te ajudar a tomar a melhor decisão.

O projeto ainda faz sentido pra você?`

describe('briefing estruturado da campanha', () => {
  it('separa fatos atuais e CTA sem preservar frases inseguras', () => {
    const brief = buildCampaignBrief(THEME)
    expect(brief.current_facts.length).toBeGreaterThan(0)
    expect(brief.cta).toBe('O projeto ainda faz sentido pra você?')
    expect(brief.normalized_theme).not.toMatch(/último contato|tomar a melhor decisão/i)
    expect(brief.normalized_theme).toMatch(/potencial de valorização/i)
  })

  it('gera mensagem neutra sem fingir contexto', () => {
    const message = renderCampaignOnlyMessage(buildCampaignBrief(THEME), 'Ana', 2)
    expect(message).toMatch(/^Oi, Ana!/) 
    expect(message).not.toMatch(/conversamos|histórico|cadastro/i)
    expect(message).not.toMatch(/La Reserva:\s*As obras do La Reserva/i)
    expect(message).not.toMatch(/fico à disposição/i)
    expect(message.endsWith('?')).toBe(true)
  })
})
