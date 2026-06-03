import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { updateDisparoLabels } from '@/app/api/campaigns/route'

interface ContactInput {
  id?: string | null
  phone: string
}

interface CreateReactivationBody {
  name: string
  instance_id: string
  reference_messages?: string[]
  interval_min?: number
  interval_max?: number
  contacts: ContactInput[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = await req.json() as CreateReactivationBody
  const {
    name,
    instance_id,
    reference_messages = [],
    interval_min = 2,
    interval_max = 5,
    contacts,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name obrigatório' }, { status: 400 })
  if (!instance_id?.trim()) return NextResponse.json({ error: 'instance_id obrigatório' }, { status: 400 })
  if (!Array.isArray(contacts) || contacts.length === 0) {
    return NextResponse.json({ error: 'contacts obrigatório' }, { status: 400 })
  }

  const service = createServiceClient()

  // 1. Criar campanha
  const { data: campaign, error: campError } = await service
    .from('reactivation_campaigns')
    .insert({
      name: name.trim(),
      instance_id,
      reference_messages,
      interval_min,
      interval_max,
      status: 'draft',
      total_leads: contacts.length,
    } as never)
    .select('id')
    .single()

  if (campError || !campaign) {
    return NextResponse.json({ error: campError?.message ?? 'Erro ao criar campanha' }, { status: 500 })
  }

  const campaignId = (campaign as { id: string }).id

  // 2. Criar dispatches para cada contato
  const dispatches = contacts.map(c => ({
    reactivation_campaign_id: campaignId,
    lead_id: c.id ?? null,
    phone: c.phone,
    status: 'pending',
  }))

  const { error: dispError } = await service
    .from('reactivation_dispatches')
    .insert(dispatches as never)

  if (dispError) {
    // Cleanup: remove campaign if dispatches failed
    await service.from('reactivation_campaigns').delete().eq('id', campaignId)
    return NextResponse.json({ error: dispError.message }, { status: 500 })
  }

  // 3. Update disparo count labels for lead contacts (non-critical)
  try {
    const leadIds = contacts
      .map(c => c.id)
      .filter((id): id is string => !!id)
    await updateDisparoLabels(service, leadIds)
  } catch { /* non-critical */ }

  return NextResponse.json({ id: campaignId })
}
