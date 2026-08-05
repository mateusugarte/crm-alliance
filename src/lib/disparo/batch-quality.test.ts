import { describe, expect, it } from 'vitest'
import { applyBatchQuality, messageSimilarity } from './batch-quality'

describe('qualidade do lote', () => {
  it('ignora a saudação ao comparar similaridade', () => {
    const a = 'Oi, Ana! A obra avançou bastante e a fundação está quase concluída. Quer receber uma atualização?'
    const b = 'Oi, Bruno! A obra avançou bastante e a fundação está quase concluída. Quer receber uma atualização?'
    expect(messageSimilarity(a, b)).toBeGreaterThan(0.9)
  })

  it('exige revisão para mensagem muito parecida com outra do lote', () => {
    const result = applyBatchQuality([
      { lead_id: '1', message: 'Oi, Ana! A obra avançou bastante e a fundação está quase concluída. Quer receber uma atualização?', quality_flags: [], approval_status: 'ready' as const },
      { lead_id: '2', message: 'Oi, Bruno! A obra avançou bastante e a fundação está quase concluída. Quer receber uma atualização?', quality_flags: [], approval_status: 'ready' as const },
    ])
    expect(result[1]?.approval_status).toBe('review')
    expect(result[1]?.quality_flags).toContain('mensagem_muito_parecida_no_lote')
  })
})
