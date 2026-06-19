import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/campaigns/[id]/contacts?limit=20
// Returns up to `limit` leads with reactivation_count=0 not already in this campaign
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const limit = Math.min(100, Math.max(1, Number(req.nextUrl.searchParams.get('limit') ?? '20')))

  const service = createServiceClient()

  // Phones already in this campaign (any status)
  const { data: existing } = await service
    .from('dispatches')
    .select('phone')
    .eq('campaign_id', id)

  const existingPhones = new Set((existing ?? []).map((d: { phone: string }) => d.phone))

  // Leads with reactivation_count = 0 (never dispatched)
  const { data: leads, error } = await service
    .from('leads')
    .select('id, name, phone')
    .eq('reactivation_count', 0)
    .order('created_at', { ascending: false })
    .limit(limit + existingPhones.size + 50) // fetch extra to account for exclusions

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = ((leads ?? []) as { id: string; name: string; phone: string }[])
    .filter(l => !existingPhones.has(l.phone))
    .slice(0, limit)

  const phones = filtered.map(l =>
    l.phone.replace('@s.whatsapp.net', '').replace(/\D/g, '')
  )

  return NextResponse.json({ leads: filtered.map(l => ({ id: l.id, name: l.name })), phones, total: phones.length })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const body = await req.json() as { phones: string[] }

  if (!Array.isArray(body.phones) || body.phones.length === 0) {
    return NextResponse.json({ error: 'phones obrigatório' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: campaign } = await service
    .from('campaigns')
    .select('id, status, total_leads')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })

  const c = campaign as { id: string; status: string; total_leads: number }
  if (c.status !== 'draft' && c.status !== 'paused') {
    return NextResponse.json({ error: 'Só é possível adicionar contatos em campanhas rascunho ou pausadas' }, { status: 422 })
  }

  // Normalize phones and deduplicate
  const normalized = body.phones
    .map(p => p.replace(/\D/g, ''))
    .filter(p => p.length >= 10 && p.length <= 15)
    .map(p => `${p}@s.whatsapp.net`)

  if (!normalized.length) return NextResponse.json({ error: 'Nenhum número válido informado' }, { status: 400 })

  const { error: insertErr } = await service
    .from('dispatches')
    .insert(normalized.map(phone => ({
      campaign_id: id,
      phone,
      status: 'pending',
    })) as never)

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  await service
    .from('campaigns')
    .update({ total_leads: c.total_leads + normalized.length } as never)
    .eq('id', id)

  return NextResponse.json({ added: normalized.length })
}
