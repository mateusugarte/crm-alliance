import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  generateReactivationMessage,
  type ReactivationGeneration,
  type ReactivationInteraction,
  type ReactivationLead,
} from '@/lib/disparo/reactivation-message'
import { buildCampaignBrief } from '@/lib/disparo/campaign-brief'
import { applyBatchQuality } from '@/lib/disparo/batch-quality'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY não configurada' }, { status: 500 })
  }

  const body = await req.json() as {
    lead_ids?: string[]
    campaign_theme?: string
    manual_contexts?: Record<string, string>
  }
  const leadIds = Array.from(new Set(body.lead_ids ?? []))
  const campaignTheme = body.campaign_theme?.trim() ?? ''

  if (!leadIds.length) {
    return NextResponse.json({ error: 'lead_ids obrigatório' }, { status: 400 })
  }
  if (leadIds.length > 50) {
    return NextResponse.json({ error: 'Máximo 50 leads por vez' }, { status: 400 })
  }
  if (!campaignTheme) {
    return NextResponse.json({ error: 'campaign_theme obrigatório' }, { status: 400 })
  }

  const service = createServiceClient()
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const campaignBrief = buildCampaignBrief(campaignTheme)
  const { data: leadsRaw, error: leadsError } = await service
    .from('leads')
    .select('id,name,phone,stage,summary,intention')
    .in('id', leadIds)

  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })
  const leads = (leadsRaw ?? []) as ReactivationLead[]
  if (!leads.length) {
    return NextResponse.json({ error: 'Nenhum lead encontrado' }, { status: 404 })
  }

  const interactions: ReactivationInteraction[] = []
  for (let index = 0; index < leadIds.length; index += 10) {
    const batch = await Promise.all(leadIds.slice(index, index + 10).map(async leadId => {
      const { data } = await service
        .from('interactions')
        .select('lead_id,direction,sender_type,content,created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(30)
      return ((data ?? []) as ReactivationInteraction[]).reverse()
    }))
    interactions.push(...batch.flat())
  }

  const byLead = new Map<string, ReactivationInteraction[]>()
  for (const interaction of interactions) {
    byLead.set(interaction.lead_id, [...(byLead.get(interaction.lead_id) ?? []), interaction])
  }

  const rawResults: ReactivationGeneration[] = []
  for (let index = 0; index < leads.length; index += 5) {
    const batch = leads.slice(index, index + 5)
    const generated = await Promise.all(batch.map(lead => generateReactivationMessage({
      openai,
      lead,
      interactions: byLead.get(lead.id) ?? [],
      campaignTheme,
      campaignBrief,
      manualContext: body.manual_contexts?.[lead.id],
    })))
    rawResults.push(...generated)
  }

  const results = applyBatchQuality(rawResults)

  const excluded = results.filter(result => !result.eligible)
  return NextResponse.json({
    results,
    excluded: excluded.map(result => ({
      lead_id: result.lead_id,
      name: result.name,
      reason: result.exclusion_reason,
    })),
    audit: {
      total: results.length,
      generated: results.filter(result => result.message).length,
      excluded: excluded.length,
      with_real_context: results.filter(result => result.context_mode === 'conversation').length,
      sparse_context: results.filter(result => result.context_mode === 'sparse').length,
      without_history: results.filter(result => result.context_mode === 'no_history').length,
      flagged: results.filter(result => result.quality_flags.length > 0 && result.eligible).length,
      adjusted: results.filter(result => result.resolution === 'ajustada').length,
      fallback: results.filter(result => result.resolution === 'fallback').length,
      personalized: results.filter(result => result.personalized).length,
      without_context: results.filter(result => result.resolution === 'sem_contexto').length,
      ready: results.filter(result => result.approval_status === 'ready').length,
      review: results.filter(result => result.approval_status === 'review').length,
      blocked: results.filter(result => result.approval_status === 'blocked').length,
      similar: results.filter(result => result.quality_flags.includes('mensagem_muito_parecida_no_lote')).length,
    },
  })
}
