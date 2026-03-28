import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'

type MeetingInsert = Database['public']['Tables']['meetings']['Insert']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('meetings')
    .select('id, datetime, lead_id, assigned_to, notes, status')
    .eq('status', 'scheduled')
    .order('datetime', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    lead_id?: string
    datetime?: string
    notes?: string
  }

  if (!body.lead_id || !body.datetime) {
    return NextResponse.json({ error: 'lead_id and datetime are required' }, { status: 400 })
  }

  const insert: MeetingInsert = {
    lead_id: body.lead_id,
    datetime: body.datetime,
    assigned_to: user.id,
    notes: body.notes ?? null,
    status: 'scheduled',
  }

  const { data, error } = await supabase
    .from('meetings')
    .insert(insert as never)
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Atualizar stage do lead para reuniao_agendada
  await supabase
    .from('leads')
    .update({ stage: 'reuniao_agendada' } as never)
    .eq('id', body.lead_id)

  return NextResponse.json({ data }, { status: 201 })
}
