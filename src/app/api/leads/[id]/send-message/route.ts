import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendTextMessage } from '@/lib/whatsapp/send'
import { toWhatsAppNumber } from '@/lib/format-phone'
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

  const content = body.content.trim()

  // Normaliza o número para o formato da UazAPI (apenas dígitos, sem @s.whatsapp.net nem espaços)
  const to = toWhatsAppNumber(leadRow.phone)
  if (!to) {
    return NextResponse.json({ error: 'Lead phone number is invalid' }, { status: 422 })
  }

  // Instância WhatsApp conectada (UazAPI) usada para envio manual
  const { data: instance } = await supabase
    .from('wa_instances')
    .select('instance_id')
    .eq('status', 'connected')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const instanceRow = instance as { instance_id: string } | null
  if (!instanceRow) {
    return NextResponse.json(
      { error: 'Nenhuma instância WhatsApp conectada. Conecte uma instância em Disparos.' },
      { status: 503 }
    )
  }

  // Nome do corretor logado (para exibir no histórico)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const senderName = (profile as { full_name: string } | null)?.full_name ?? 'Corretor'

  // Enviar via UazAPI — só persiste a interação se a UazAPI confirmar o envio
  const result = await sendTextMessage(instanceRow.instance_id, to, content)
  if (!result.success) {
    console.error('[send-message] Falha na UazAPI:', result.error)
    return NextResponse.json(
      { error: 'Falha ao enviar mensagem no WhatsApp', detail: result.error },
      { status: 502 }
    )
  }

  // Salvar interação outbound (com wa_message_id retornado pela UazAPI)
  const insert: InteractionInsert = {
    lead_id: id,
    direction: 'outbound',
    sender_type: 'corretor',
    sender_name: senderName,
    content,
    wa_message_id: result.wa_message_id ?? null,
  }
  const { error: insertError } = await supabase
    .from('interactions')
    .insert(insert as never)

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ data: { sent: true, wa_message_id: result.wa_message_id } })
}
