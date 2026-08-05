import { describe, expect, it } from 'vitest'
import { attemptLabel, formatDailyFollowupMessage, scoreLabel } from './whatsapp'

describe('daily follow-up message', () => {
  it('formats attempts and score using the approved copy', () => {
    expect(attemptLabel(1)).toBe('nunca ligado')
    expect(attemptLabel(2)).toBe('2ª tentativa')
    expect(scoreLabel(76)).toBe('7,6')
  })

  it('contains only the contacts supplied to the formatter', () => {
    const message = formatDailyFollowupMessage([
      { tarefa_id: '1', name: 'Cintia Zambon', tentativa_num: 1, lead_score: 76, no_contact_days: 5 },
      { tarefa_id: '2', name: 'Millena Bastos', tentativa_num: 2, lead_score: 64, no_contact_days: 9 },
      { tarefa_id: '3', name: 'Reginaldo', tentativa_num: 1, lead_score: 51, no_contact_days: 12 },
    ], 'https://crm-alliance.vercel.app')

    expect(message).toContain('*FOLLOW UP DO DIA - LIGAÇÕES*')
    expect(message).toContain('3 contatos para follow up hoje:')
    expect(message).toContain('1. Cintia Zambon - nunca ligado - score 7,6 - 5 d sem contato')
    expect(message).toContain('2. Millena Bastos - 2ª tentativa - score 6,4 - 9 d sem contato')
    expect(message).toContain('https://crm-alliance.vercel.app/dashboard')
    expect(message).not.toContain('Responsável:')
  })
})
