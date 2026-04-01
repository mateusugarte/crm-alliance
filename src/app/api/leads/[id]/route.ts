import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type LeadUpdate = Database['public']['Tables']['leads']['Update']

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
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Fetch labels for the lead
  type LabelLink = { label_id: string; labels: { id: string; name: string; color: string } | null }
  const { data: labelLinks } = await (supabase
    .from('lead_labels')
    .select('label_id, labels(id, name, color)')
    .eq('lead_id', id) as unknown as Promise<{ data: LabelLink[] | null; error: unknown }>)

  const labels = (labelLinks ?? []).flatMap((row) => {
    return row.labels ? [row.labels] : []
  })

  return NextResponse.json({ data: { ...(data as object), labels } })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await request.json() as Partial<{
    name: string
    phone: string
    city: string
    stage: LeadUpdate['stage']
    intention: LeadUpdate['intention']
    imovel_interesse: string
    summary: string
  }>

  const update: LeadUpdate = {
    ...(body.name !== undefined && { name: body.name }),
    ...(body.phone !== undefined && { phone: body.phone }),
    ...(body.city !== undefined && { city: body.city }),
    ...(body.stage !== undefined && { stage: body.stage }),
    ...(body.intention !== undefined && { intention: body.intention }),
    ...(body.imovel_interesse !== undefined && { imovel_interesse: body.imovel_interesse }),
    ...(body.summary !== undefined && { summary: body.summary }),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('leads')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('leads')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
