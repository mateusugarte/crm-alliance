import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type LeadUpdate = Database['public']['Tables']['leads']['Update']

// GET /api/leads/[id] — busca lead com labels
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('leads')
    .select('*, lead_labels(label_id, labels(id, name, color))')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// PUT /api/leads/[id] — atualiza campos editáveis do lead
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await request.json() as {
    name?: string
    phone?: string
    city?: string
    stage?: string
    intention?: 'morar' | 'investir' | null
    imovel_interesse?: string | null
    summary?: string | null
    assigned_to?: string | null
  }

  const VALID_STAGES = ['lead_frio', 'lead_morno', 'lead_quente', 'follow_up', 'reuniao_agendada', 'visita_confirmada', 'cliente'] as const
  type Stage = typeof VALID_STAGES[number]

  const update: LeadUpdate = {}

  if (body.name !== undefined) update.name = body.name.trim()
  if (body.phone !== undefined) update.phone = body.phone.trim()
  if (body.city !== undefined) update.city = body.city?.trim() ?? null
  if (body.stage !== undefined && VALID_STAGES.includes(body.stage as Stage)) {
    update.stage = body.stage as Stage
  }
  if (body.intention !== undefined) update.intention = body.intention
  if (body.imovel_interesse !== undefined) update.imovel_interesse = body.imovel_interesse
  if (body.summary !== undefined) update.summary = body.summary
  if (body.assigned_to !== undefined) update.assigned_to = body.assigned_to

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  update.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('leads')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// DELETE /api/leads/[id] — deleta lead (adm ou corretor assignado)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Verificar permissão: adm pode deletar qualquer lead, corretor só o seu
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: 'adm' | 'corretor' } | null

  if (profile?.role !== 'adm') {
    // Verificar se o lead está assignado a este usuário
    const { data: leadData } = await supabase
      .from('leads')
      .select('assigned_to')
      .eq('id', id)
      .single()

    const lead = leadData as { assigned_to: string | null } | null

    if (!lead) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (lead.assigned_to !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data: { id } })
}
