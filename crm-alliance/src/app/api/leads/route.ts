import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database, Lead } from '@/lib/supabase/types'

type LeadInsert = Database['public']['Tables']['leads']['Insert']

// GET /api/leads?search=<query>&stage=<stage>&assigned=<ia|consultor>
// Busca server-side de leads com filtros opcionais
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim() ?? ''
  const stage = searchParams.get('stage') ?? ''
  const assigned = searchParams.get('assigned') ?? ''

  let query = supabase
    .from('leads')
    .select('*')
    .order('updated_at', { ascending: false })

  // Filtro de busca por nome ou telefone (ilike para case-insensitive)
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  // Filtro por stage
  if (stage) {
    const validStages = ['lead_frio', 'lead_morno', 'lead_quente', 'follow_up', 'reuniao_agendada', 'visita_confirmada', 'cliente']
    if (validStages.includes(stage)) {
      query = query.eq('stage', stage as Lead['stage'])
    }
  }

  // Filtro por tipo de atendimento
  if (assigned === 'ia') {
    query = query.is('assigned_to', null)
  } else if (assigned === 'consultor') {
    query = query.not('assigned_to', 'is', null)
  }

  // Limite razoavel para evitar payloads grandes
  query = query.limit(100)

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/leads] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: (data ?? []) as Lead[], total: (data ?? []).length })
}

// POST /api/leads — criar novo lead
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    name?: string
    phone?: string
    stage?: string
    assigned_to?: string
    intention?: 'morar' | 'investir'
    city?: string
  }

  if (!body.name?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: 'name and phone are required' }, { status: 400 })
  }

  const VALID_STAGES = ['lead_frio', 'lead_morno', 'lead_quente', 'follow_up', 'reuniao_agendada', 'visita_confirmada', 'cliente'] as const
  type Stage = typeof VALID_STAGES[number]

  const stage = (body.stage && VALID_STAGES.includes(body.stage as Stage))
    ? (body.stage as Stage)
    : 'lead_frio'

  const insert: LeadInsert = {
    name: body.name.trim(),
    phone: body.phone.trim(),
    stage,
    assigned_to: body.assigned_to ?? null,
    intention: body.intention ?? null,
    city: body.city?.trim() ?? null,
  }

  const { data, error } = await supabase
    .from('leads')
    .insert(insert as never)
    .select('*')
    .single()

  if (error) {
    console.error('[POST /api/leads] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: data as Lead }, { status: 201 })
}
