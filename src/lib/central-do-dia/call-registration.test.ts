import { describe, expect, it } from 'vitest'
import { parseCallRegistration } from './call-registration'
import { callResultLabel } from './outcomes'

describe('parseCallRegistration', () => {
  it('normaliza um registro atendido', () => {
    expect(parseCallRegistration({ outcome: 'atendeu', note: '  Pediu proposta  ', meetingScheduled: true })).toEqual({
      ok: true,
      data: {
        outcome: 'atendeu', note: 'Pediu proposta', returnAt: null,
        meetingScheduled: true, lossReason: null,
      },
    })
  })

  it('exige os dados condicionais de cada desfecho', () => {
    expect(parseCallRegistration({ outcome: 'atendeu' })).toEqual({
      ok: true,
      data: {
        outcome: 'atendeu', note: null, returnAt: null,
        meetingScheduled: false, lossReason: null,
      },
    })
    expect(parseCallRegistration({ outcome: 'pediu_retorno' }).ok).toBe(false)
    expect(parseCallRegistration({ outcome: 'sem_interesse' }).ok).toBe(false)
  })
})

describe('callResultLabel', () => {
  it('preserva o resultado comercial depois de uma ligação atendida', () => {
    expect(callResultLabel('atendeu')).toBe('Atendeu · em conversa')
    expect(callResultLabel('atendeu', true)).toBe('Atendeu · reunião marcada')
    expect(callResultLabel('nao_atendeu')).toBe('Não atendeu')
  })
})
