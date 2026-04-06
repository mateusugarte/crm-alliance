import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type MeetingUpdate = Database['public']['Tables']['meetings']['Update']

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('meetings')
    .select('id, title, datetime, notes, status, lead_id, assigned_to')
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ data })
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
    title: string
    datetime: string
    notes: string
    lead_id: string
    status: MeetingUpdate['status']
  }>

  const update: MeetingUpdate = {
    ...(body.title    !== undefined && { title: body.title }),
    ...(body.datetime !== undefined && { datetime: body.datetime }),
    ...(body.notes    !== undefined && { notes: body.notes }),
    ...(body.lead_id  !== undefined && { lead_id: body.lead_id }),
    ...(body.status   !== undefined && { status: body.status }),
  }

  const { data, error } = await supabase
    .from('meetings')
    .update(update as never)
    .eq('id', id)
    .select('id, title, datetime, notes, status, lead_id, assigned_to')
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
    .from('meetings')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
