import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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

  // Verificar que o lead tem automação pausada
  const { data: lead } = await supabase
    .from('leads')
    .select('automation_paused, phone')
    .eq('id', id)
    .single()

  const leadRow = lead as { automation_paused: boolean; phone: string } | null

  if (!leadRow) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (!leadRow.automation_paused) {
    return NextResponse.json({ error: 'Cannot send manual message while automation is active' }, { status: 403 })
  }

  // Salvar interação outbound
  const insert: InteractionInsert = { lead_id: id, direction: 'outbound', content: body.content.trim() }
  const { error: insertError } = await supabase
    .from('interactions')
    .insert(insert as never)

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  // Enviar via Meta API (requer WHATSAPP_ACCESS_TOKEN configurado)
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (accessToken && phoneNumberId && accessToken !== 'EAABs...') {
    try {
      await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: leadRow.phone,
          type: 'text',
          text: { body: body.content.trim() },
        }),
      })
    } catch {
      // Log em produção — não bloquear a resposta
    }
  }

  return NextResponse.json({ data: { sent: true } })
}
