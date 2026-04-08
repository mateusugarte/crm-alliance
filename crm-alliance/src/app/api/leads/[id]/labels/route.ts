import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type LeadLabelInsert = Database['public']['Tables']['lead_labels']['Insert']

// POST /api/leads/[id]/labels — adiciona etiqueta a um lead
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: lead_id } = await params

  const body = await request.json() as { label_id?: string }

  if (!body.label_id?.trim()) {
    return NextResponse.json({ error: 'label_id is required' }, { status: 400 })
  }

  const insert: LeadLabelInsert = {
    lead_id,
    label_id: body.label_id.trim(),
  }

  const { data, error } = await supabase
    .from('lead_labels')
    .insert(insert as never)
    .select('lead_id, label_id, created_at')
    .single()

  if (error) {
    // Código 23505 = violação de unique — etiqueta já associada
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Label already assigned to this lead' }, { status: 409 })
    }
    console.error('[POST /api/leads/[id]/labels] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data }, { status: 201 })
}

// DELETE /api/leads/[id]/labels — remove etiqueta de um lead
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: lead_id } = await params

  const body = await request.json() as { label_id?: string }

  if (!body.label_id?.trim()) {
    return NextResponse.json({ error: 'label_id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('lead_labels')
    .delete()
    .eq('lead_id', lead_id)
    .eq('label_id', body.label_id.trim())

  if (error) {
    console.error('[DELETE /api/leads/[id]/labels] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { lead_id, label_id: body.label_id } })
}
