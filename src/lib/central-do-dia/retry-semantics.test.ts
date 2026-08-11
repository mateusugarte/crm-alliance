import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('hot lead retry semantics', () => {
  const migration = readFileSync(resolve(process.cwd(), '037_hot_lead_retry_semantics.sql'), 'utf8')

  it('blocks new open retry tasks outside lead_quente', () => {
    expect(migration).toContain("l.stage='lead_quente'")
    expect(migration).toContain('tarefas_retentativa_hot_insert')
  })

  it('cancels an open retry when the lead is no longer hot', () => {
    expect(migration).toContain('leads_cancel_retry_outside_hot')
    expect(migration).toContain("SET status='cancelada'")
    expect(migration).toContain("AND l.stage<>'lead_quente'")
  })
})
