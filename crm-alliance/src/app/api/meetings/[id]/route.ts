import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type MeetingUpdate = Database['public']['Tables']['meetings']['Update']

// GET /api/meetings/[id] — busca reunião com dados do lead
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
    .select('*, leads(id, name, phone, stage)')
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

// PUT /api/meetings/[id] — atualiza reunião
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const body = await request.json() as {
    datetime?: string
    notes?: string | null
    status?: 'scheduled' | 'completed' | 'cancelled'
  }

  const VALID_STATUSES = ['scheduled', 'completed', 'cancelled'] as const
  type Status = typeof VALID_STATUSES[number]

  const update: MeetingUpdate = {}

  if (body.datetime !== undefined) update.datetime = body.datetime
  if (body.notes !== undefined) update.notes = body.notes
  if (body.status !== undefined && VALID_STATUSES.includes(body.status as Status)) {
    update.status = body.status as Status
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('meetings')
    .update(update as never)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    console.error('[PUT /api/meetings/[id]] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

// DELETE /api/meetings/[id] — deleta reunião
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

  if (error) {
    console.error('[DELETE /api/meetings/[id]] Supabase error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: { id } })
}
