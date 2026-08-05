import { describe, expect, it } from 'vitest'
import type OpenAI from 'openai'
import { generateReactivationMessage } from './reactivation-message'
import type { BriefInteraction, BriefLead } from './lead-brief'

const theme = 'A fundação do La Reserva está praticamente concluída e, em breve, começamos a subir os andares. O projeto ainda faz sentido para você?'
const lead = (over: Partial<BriefLead> = {}): BriefLead => ({
  id: 'lead-1', name: 'Ana Paula', phone: '5527999999999', stage: 'lead_frio',
  summary: null, intention: null, ...over,
})
const inbound = (content: string): BriefInteraction => ({
  lead_id: 'lead-1', direction: 'inbound', sender_type: 'lead', content,
  created_at: '2026-01-10T12:00:00.000Z',
})

function fakeOpenAI(
  onPrompt?: (prompt: string) => void,
  usedFactIds: string[] = [],
) {
  return {
    chat: {
      completions: {
        create: async (input: { messages: Array<{ role: string; content: string }> }) => {
          onPrompt?.(input.messages[1]?.content ?? '')
          return {
            choices: [{ message: { content: JSON.stringify({
              message: 'Oi, Ana! A fundação do La Reserva está praticamente concluída e, em breve, começam os andares. Se as condições de pagamento ainda forem relevantes, posso trazer uma atualização. Quer que eu envie?',
              used_fact_ids: usedFactIds,
            }) } }],
          }
        },
      },
    },
  } as unknown as OpenAI
}

describe('geração controlada', () => {
  it('não chama a IA para público desconhecido e exige revisão', async () => {
    let called = false
    const result = await generateReactivationMessage({
      openai: fakeOpenAI(() => { called = true }), lead: lead(), interactions: [], campaignTheme: theme,
    })
    expect(called).toBe(false)
    expect(result.approval_status).toBe('review')
    expect(result.audience.type).toBe('unknown')
    expect(result.personalized).toBe(false)
  })

  it('não envia fala literal nem valor antigo para o prompt', async () => {
    let prompt = ''
    const result = await generateReactivationMessage({
      openai: fakeOpenAI(value => { prompt = value }),
      lead: lead(),
      interactions: [inbound('Tenho um lote e consigo dar R$ 125.000 de entrada. Como funciona o financiamento?')],
      campaignTheme: theme,
    })
    expect(prompt).not.toContain('125.000')
    expect(prompt).not.toContain('Tenho um lote')
    expect(prompt).toContain('demonstrou interesse em financiamento ou condições de pagamento')
    expect(result.approval_status).toBe('ready')
    expect(result.personalized).toBe(true)
  })

  it('bloqueia fornecedor sem chamar a IA', async () => {
    let called = false
    const result = await generateReactivationMessage({
      openai: fakeOpenAI(() => { called = true }),
      lead: lead({ stage: 'fornecedores' }), interactions: [], campaignTheme: theme,
    })
    expect(called).toBe(false)
    expect(result.approval_status).toBe('blocked')
    expect(result.message).toBe('')
  })

  it('não descarta texto seguro quando o modelo erra apenas o ID do fato', async () => {
    const result = await generateReactivationMessage({
      openai: fakeOpenAI(undefined, ['fato-inexistente']),
      lead: lead(),
      interactions: [inbound('Como funciona o financiamento?')],
      campaignTheme: theme,
    })

    expect(result.approval_status).toBe('ready')
    expect(result.personalized).toBe(true)
    expect(result.resolution).not.toBe('fallback')
    expect(result.quality_flags).toContain('fato_fora_do_plano')
  })
})
