import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(join(process.cwd(), '040_shared_followup_visibility.sql'), 'utf8')
const taskLoader = readFileSync(join(process.cwd(), 'src/lib/central-do-dia/tasks.ts'), 'utf8')
const taskCenter = readFileSync(join(process.cwd(), 'src/components/dashboard/daily-task-center.tsx'), 'utf8')

describe('shared follow-up visibility', () => {
  it('allows every authenticated user to read the team queue', () => {
    expect(migration).toContain('CREATE POLICY "tarefas: equipe le"')
    expect(migration).toContain('CREATE POLICY "fila: equipe le"')
    expect(migration.match(/FOR SELECT TO authenticated USING \(true\)/g)).toHaveLength(2)
    expect(taskLoader).not.toContain("eq('responsavel_id', userId)")
  })

  it('keeps completion atomic while attributing it to the acting user', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION registrar_ligacao_equipe_v1')
    expect(migration).toContain('SET responsavel_id=auth.uid()')
    expect(migration).toContain('RETURN registrar_ligacao_v2(')
  })

  it('publishes lead movement for the shared Kanban', () => {
    expect(migration).toContain('ALTER PUBLICATION supabase_realtime ADD TABLE leads')
  })

  it('finishes the spinner when a silent realtime refresh replaces the initial load', () => {
    expect(taskCenter).toContain('activeLoad.current = null\n        setLoading(false)')
    expect(taskCenter).not.toContain('if (!quiet) setLoading(false)')
  })
})
