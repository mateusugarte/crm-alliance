import { describe, expect, it } from 'vitest'
import { zonedDayRange } from './timezone'

describe('zonedDayRange', () => {
  it('keeps the Sao Paulo day after UTC midnight', () => {
    const range = zonedDayRange(new Date('2026-08-06T01:30:00.000Z'))
    expect(range).toEqual({
      startIso: '2026-08-05T03:00:00.000Z',
      endExclusiveIso: '2026-08-06T03:00:00.000Z',
      startDate: '2026-08-05',
      endExclusiveDate: '2026-08-06',
    })
  })

  it('builds a Monday-to-Monday week in the business timezone', () => {
    const range = zonedDayRange(new Date('2026-08-05T15:00:00.000Z'), 'week')
    expect(range.startDate).toBe('2026-08-03')
    expect(range.endExclusiveDate).toBe('2026-08-10')
    expect(range.startIso).toBe('2026-08-03T03:00:00.000Z')
    expect(range.endExclusiveIso).toBe('2026-08-10T03:00:00.000Z')
  })
})
