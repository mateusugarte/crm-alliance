import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'

type LeadUpdate = Database['public']['Tables']['leads']['Update']

interface N8NPayload {
  lead_id: string
  stage?: string
  summary?: string
}

export async function POST(request: NextRequest) {
  const secret = process.env.N8N_WEBHOOK_SECRET
  const incomingSecret = request.headers.get('x-webhook-secret')

  if (secret && secret !== 'seu_secret_aleatorio_aqui' && incomingSecret !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json() as N8NPayload

  if (!body.lead_id) {
    return NextResponse.json({ error: 'lead_id required' }, { status: 400 })
  }

  // SEC-03: usar SERVICE_ROLE_KEY para bypasaar RLS
  // O N8N atualiza leads independente de assigned_to — ANON_KEY bloqueava silenciosamente
  const supabase = createServiceClient()

  const updates: LeadUpdate = { updated_at: new Date().toISOString() }
  if (body.stage) updates['stage'] = body.stage as LeadUpdate['stage']
  if (body.summary) updates['summary'] = body.summary

  const { error } = await supabase
    .from('leads')
    .update(updates as never)
    .eq('id', body.lead_id)

  if (error) {
    console.error('[webhook/n8n] Erro ao atualizar lead:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { updated: true } })
}
