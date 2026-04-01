import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { data, error } = await supabase
    .from('interactions')
    .select('id, direction, content, wa_message_id, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as { direction?: string; content?: string }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content é obrigatório' }, { status: 400 })
  }

  const direction = body.direction === 'outbound' ? 'outbound' : 'inbound'

  const { data, error } = await supabase
    .from('interactions')
    .insert({
      lead_id: id,
      direction,
      content: body.content.trim(),
    } as never)
    .select('id, direction, content, wa_message_id, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
