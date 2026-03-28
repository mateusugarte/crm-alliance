import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/whatsapp/send'
import type { Database } from '@/lib/supabase/types'

type InteractionInsert = Database['public']['Tables']['interactions']['Insert']

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
    return NextResponse.json({ error: 'content is required' }, { status: 400 })
  }

  const { data: lead } = await supabase
    .from('leads')
    .select('automation_paused, phone')
    .eq('id', id)
    .single()

  const leadRow = lead as { automation_paused: boolean; phone: string } | null

  if (!leadRow) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (!leadRow.automation_paused) {
    return NextResponse.json(
      { error: 'Cannot send manual message while automation is active' },
      { status: 403 }
    )
  }

  // Salvar interacao outbound
  const insert: InteractionInsert = {
    lead_id: id,
    direction: 'outbound',
    content: body.content.trim(),
  }
  const { error: insertError } = await supabase
    .from('interactions')
    .insert(insert as never)

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // SEC-04: usar lib/whatsapp/send.ts — sem duplicacao de logica, sem catch vazio
  const result = await sendTextMessage(leadRow.phone, body.content.trim())

  if (!result.success) {
    // Interacao ja foi salva — logar o erro mas nao reverter
    console.error('[send-message] Falha na Meta API:', result.error)
  }

  return NextResponse.json({ data: { sent: true, wa_message_id: result.wa_message_id ?? null } })
}
