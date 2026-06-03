import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateDisparoLabels } from '@/lib/disparo-labels'

interface CreateCampaignBody {
  name: string
  template_ids?: string[]
  instance_id: string
  interval_min?: number
  interval_max?: number
  phones: string | string[]
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error: dbErr } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false })

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json() as CreateCampaignBody
  const {
    name,
    template_ids = [],
    instance_id,
    interval_min = 2,
    interval_max = 5,
    phones: phonesRaw = [],
  } = body

  // Accept both comma-separated string (external service format) and array
  const phones: string[] = Array.isArray(phonesRaw)
    ? phonesRaw
    : String(phonesRaw).split(',').map(p => p.trim()).filter(Boolean)

  if (!name?.trim()) return NextResponse.json({ error: 'name obrigatório' }, { status: 400 })
  if (!instance_id?.trim()) return NextResponse.json({ error: 'instance_id obrigatório' }, { status: 400 })
  if (!phones.length) return NextResponse.json({ error: 'phones obrigatório' }, { status: 400 })

  const service = createServiceClient()

  // 1. Create campaign
  const { data: campaign, error: campError } = await service
    .from('campaigns')
    .insert({
      name: name.trim(),
      instance_id,
      template_ids,
      interval_min,
      interval_max,
      status:      'draft',
      total_leads: phones.length,
    } as never)
    .select('id')
    .single()

  if (campError || !campaign) {
    return NextResponse.json({ error: campError?.message ?? 'Erro ao criar campanha' }, { status: 500 })
  }

  const campaignId = (campaign as { id: string }).id

  // 2. Create dispatches
  const { error: dispError } = await service
    .from('dispatches')
    .insert(phones.map(phone => ({
      campaign_id: campaignId,
      phone,
      status: 'pending',
    })) as never)

  if (dispError) {
    await service.from('campaigns').delete().eq('id', campaignId)
    return NextResponse.json({ error: dispError.message }, { status: 500 })
  }

  // 3. Update disparo count labels for matched leads (non-critical)
  try {
    const { data: allLeads } = await service.from('leads').select('id, phone')
    if (allLeads) {
      const phoneToLeadId = new Map<string, string>()
      for (const l of allLeads as { id: string; phone: string }[]) {
        phoneToLeadId.set(
          l.phone.replace('@s.whatsapp.net', '').replace(/\D/g, ''),
          l.id,
        )
      }
      const leadIds = phones
        .map(p => phoneToLeadId.get(p.replace('@s.whatsapp.net', '').replace(/\D/g, '')))
        .filter((id): id is string => !!id)

      await updateDisparoLabels(service, leadIds)
    }
  } catch { /* non-critical — label update failure must not break campaign creation */ }

  return NextResponse.json({ id: campaignId })
}
