import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type LeadInsert = Database['public']['Tables']['leads']['Insert']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as Partial<{
    name: string
    phone: string
    city: string
    stage: LeadInsert['stage']
    intention: LeadInsert['intention']
    imovel_interesse: string
  }>

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  if (!body.phone?.trim()) {
    return NextResponse.json({ error: 'phone is required' }, { status: 400 })
  }

  const insert: LeadInsert = {
    name: body.name.trim(),
    phone: body.phone.trim(),
    city: body.city?.trim() || null,
    stage: body.stage ?? 'lead_frio',
    intention: body.intention ?? null,
    imovel_interesse: body.imovel_interesse?.trim() || null,
    automation_paused: true, // leads manuais começam com IA pausada
  }

  const { data, error } = await supabase
    .from('leads')
    .insert(insert as never)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
