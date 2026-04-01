import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { label_id?: string }
  if (!body.label_id) {
    return NextResponse.json({ error: 'label_id is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('lead_labels')
    .insert({ lead_id: id, label_id: body.label_id } as never)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(request.url)
  const labelId = searchParams.get('label_id')
  if (!labelId) {
    return NextResponse.json({ error: 'label_id query param required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('lead_labels')
    .delete()
    .eq('lead_id', id)
    .eq('label_id', labelId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
