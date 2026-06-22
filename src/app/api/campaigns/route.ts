import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateDisparoLabels } from '@/lib/disparo-labels'
import { recordDispatchToMemory } from '@/lib/pg-memory'

interface ContactInput {
  phone: string
  message?: string
  typing_delay?: number
}

interface CreateCampaignBody {
  name: string
  template_ids?: string[]
  instance_id: string
  interval_min?: number
  interval_max?: number
  allowed_hours_start?: number
  allowed_hours_end?: number
  phones?: string | string[]   // legado
  contacts?: ContactInput[]    // novo formato
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
    allowed_hours_start = 0,
    allowed_hours_end   = 23,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name obrigatório' }, { status: 400 })
  if (!instance_id?.trim()) return NextResponse.json({ error: 'instance_id obrigatório' }, { status: 400 })

  // Normalizar contacts (aceitar phones legado ou contacts novo formato)
  let normalizedContacts: ContactInput[]
  if (body.contacts && body.contacts.length > 0) {
    normalizedContacts = body.contacts
  } else {
    const phonesRaw = body.phones ?? []
    const phonesArr: string[] = Array.isArray(phonesRaw)
      ? phonesRaw
      : String(phonesRaw).split(',').map(p => p.trim()).filter(Boolean)
    normalizedContacts = phonesArr.map(phone => ({ phone }))
  }

  if (!normalizedContacts.length) {
    return NextResponse.json({ error: 'phones ou contacts obrigatório' }, { status: 400 })
  }

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
      allowed_hours_start,
      allowed_hours_end,
      status:      'draft',
      total_leads: normalizedContacts.length,
    } as never)
    .select('id')
    .single()

  if (campError || !campaign) {
    return NextResponse.json({ error: campError?.message ?? 'Erro ao criar campanha' }, { status: 500 })
  }

  const campaignId = (campaign as { id: string }).id

  // 2. Create dispatches (incluindo message_sent e typing_delay quando disponíveis)
  const { error: dispError } = await service
    .from('dispatches')
    .insert(normalizedContacts.map(c => ({
      campaign_id: campaignId,
      phone: c.phone,
      status: 'pending',
      message_sent: c.message ?? null,
      typing_delay: c.typing_delay ?? null,
    })) as never)

  if (dispError) {
    await service.from('campaigns').delete().eq('id', campaignId)
    return NextResponse.json({ error: dispError.message }, { status: 500 })
  }

  // 3. Registrar mensagens na memória do agente IA (não-crítico)
  const toRecord = normalizedContacts.filter(c => !!c.message)
  if (toRecord.length) {
    await Promise.allSettled(
      toRecord.map(c => recordDispatchToMemory(c.phone, c.message!))
    )
  }

  // 4. Update disparo count labels for matched leads (non-critical)
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
      const leadIds = normalizedContacts
        .map(c => phoneToLeadId.get(c.phone.replace('@s.whatsapp.net', '').replace(/\D/g, '')))
        .filter((id): id is string => !!id)

      await updateDisparoLabels(service, leadIds)

      if (leadIds.length) {
        await service.from('leads').update({ via_disparo: true } as never).in('id', leadIds)
      }
    }
  } catch { /* non-critical — label update failure must not break campaign creation */ }

  return NextResponse.json({ id: campaignId })
}
