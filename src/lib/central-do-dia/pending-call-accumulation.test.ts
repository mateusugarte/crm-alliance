import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('pending call accumulation migration', () => {
  const migration = readFileSync(resolve(process.cwd(), '034_pending_call_accumulation.sql'), 'utf8')

  it('carries pending and overdue tasks without excluding resgate follow-ups', () => {
    expect(migration).toContain("WHERE t.status IN ('pendente','vencida')")
    expect(migration).not.toContain("t.origem <> 'resgate'")
  })

  it('keeps duplicate prevention for open tasks', () => {
    expect(migration).toContain("t.status IN ('pendente','vencida')")
    expect(migration).toContain('NOT EXISTS (')
  })
})
