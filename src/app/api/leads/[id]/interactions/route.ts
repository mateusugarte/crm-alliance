import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SELECT_FIELDS = 'id, direction, sender_type, sender_name, content, wa_message_id, created_at'

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
    .select(SELECT_FIELDS)
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
  const body = await request.json() as { content?: string }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'content é obrigatório' }, { status: 400 })
  }

  // Busca o nome do corretor para exibição no chat
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  const { data, error } = await supabase
    .from('interactions')
    .insert({
      lead_id: id,
      direction: 'outbound',
      sender_type: 'corretor',
      sender_name: profile?.full_name ?? 'Corretor',
      content: body.content.trim(),
    } as never)
    .select(SELECT_FIELDS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
