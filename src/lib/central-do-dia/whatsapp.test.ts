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
      { tarefa_id: '1', name: 'Cintia Zambon', tentativa_num: 1, lead_score: 76, no_contact_days: 5, origem: 'resgate', overdue_days: 2 },
      { tarefa_id: '2', name: 'Millena Bastos', tentativa_num: 2, lead_score: 64, no_contact_days: 9, origem: 'retentativa', overdue_days: 0 },
      { tarefa_id: '3', name: 'Reginaldo', tentativa_num: 1, lead_score: 51, no_contact_days: 12, origem: 'resgate', overdue_days: 0 },
    ], 'https://crm-alliance.vercel.app')

    expect(message).toContain('*FOLLOW UP DO DIA - LIGAÇÕES*')
    expect(message).toContain('*3 contatos pendentes*')
    expect(message).toContain('*FOLLOW UPS ATRASADOS · 1*')
    expect(message).toContain('*RETENTATIVAS AGENDADAS PARA HOJE · 1*')
    expect(message).toContain('*FOLLOW UPS SUGERIDOS PARA HOJE · 1*')
    expect(message).toContain('1. Cintia Zambon - nunca ligado - score 7,6 - 5 d sem contato')
    expect(message).toContain('1. Millena Bastos - 2ª tentativa - score 6,4 - 9 d sem contato')
    expect(message).toContain('https://crm-alliance.vercel.app/dashboard')
    expect(message).not.toContain('Responsável:')
  })

  it('separates qualification and scheduled returns before the regular follow ups', () => {
    const message = formatDailyFollowupMessage([
      { tarefa_id: '1', name: 'Lead quente', tentativa_num: 1, lead_score: 90, no_contact_days: 0, origem: 'qualificacao', overdue_days: 0 },
      { tarefa_id: '2', name: 'Retorno marcado', tentativa_num: 2, lead_score: 70, no_contact_days: 2, origem: 'retorno_agendado', overdue_days: 0 },
      { tarefa_id: '3', name: 'Sugestão', tentativa_num: 1, lead_score: 50, no_contact_days: 10, origem: 'resgate', overdue_days: 0 },
    ], 'https://crm-alliance.vercel.app')

    expect(message.indexOf('LEADS QUENTES AGUARDANDO PRIMEIRO CONTATO')).toBeLessThan(
      message.indexOf('RETORNOS COMBINADOS'),
    )
    expect(message.indexOf('RETORNOS COMBINADOS')).toBeLessThan(
      message.indexOf('FOLLOW UPS SUGERIDOS PARA HOJE'),
    )
    expect(message).not.toContain('FOLLOW UPS ATRASADOS')
  })
})
