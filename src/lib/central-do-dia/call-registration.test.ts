import { describe, expect, it } from 'vitest'
import { parseCallRegistration } from './call-registration'

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
    expect(parseCallRegistration({ outcome: 'atendeu' }).ok).toBe(false)
    expect(parseCallRegistration({ outcome: 'pediu_retorno' }).ok).toBe(false)
    expect(parseCallRegistration({ outcome: 'sem_interesse' }).ok).toBe(false)
  })
})
