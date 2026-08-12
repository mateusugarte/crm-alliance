import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(resolve(process.cwd(), '039_answered_call_stage_flow.sql'), 'utf8')

describe('answered call stage flow', () => {
  it('maps the three answered results to their CRM stages', () => {
    expect(migration).toContain("WHEN p_desfecho='atendeu' AND COALESCE(p_marcou_reuniao,false) THEN 'reuniao_agendada'")
    expect(migration).toContain("WHEN p_desfecho='atendeu' THEN 'lead_quente'")
    expect(migration).toContain("WHEN p_desfecho='sem_interesse' THEN 'sem_interesse'")
  })

  it('creates a distinct five-day follow-up only for an ongoing conversation', () => {
    expect(migration).toContain("ELSIF p_desfecho='atendeu' AND NOT COALESCE(p_marcou_reuniao,false) THEN")
    expect(migration).toContain("interval '5 days'")
    expect(migration).toContain("'acompanhamento',v_tentativas+1,v_proxima")
  })

  it('updates first contact and stage in the same lead update', () => {
    const leadUpdate = migration.slice(
      migration.indexOf('UPDATE leads SET'),
      migration.indexOf('WHERE id=v_lead.id'),
    )
    expect(leadUpdate).toContain('primeira_ligacao_em=COALESCE(primeira_ligacao_em, now())')
    expect(leadUpdate).toContain("WHEN p_desfecho='atendeu' THEN 'lead_quente'")
  })

  it('keeps the call observation optional', () => {
    expect(migration).not.toContain("p_desfecho='atendeu' AND NULLIF(btrim(p_observacao), '') IS NULL")
  })

  it('cancels the automatic follow-up when the lead leaves hot', () => {
    expect(migration).toContain("t.origem='acompanhamento' AND NEW.stage <> 'lead_quente'")
  })
})
