import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('daily session access audit', () => {
  const migration = readFileSync(resolve(process.cwd(), '036_session_access_boundaries.sql'), 'utf8')

  it('preserves the first access and advances the latest activity', () => {
    expect(migration).toContain('first_seen_at=LEAST')
    expect(migration).toContain('last_seen_at=GREATEST')
    expect(migration).toContain('logged_at=LEAST')
  })

  it('uses latest activity in the user overview', () => {
    expect(migration).toContain('MAX(COALESCE(l.last_seen_at,l.logged_at))')
  })
})
