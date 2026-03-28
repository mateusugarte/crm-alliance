import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Lead } from '@/lib/supabase/types'

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
