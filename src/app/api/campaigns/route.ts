import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

interface CreateCampaignBody {
  name: string
  template_ids?: string[]
  instance_id: string
  interval_min?: number
  interval_max?: number
  phones: string[]
}

// ── Disparo count label helpers ───────────────────────────────────────────────

const DISPARO_LABEL_PREFIX = 'Disparo '
const DISPARO_LABEL_SUFFIX = '×'
const DISPARO_LABEL_COLOR  = '#f97316' // orange-500

function parseDisparoCount(name: string): number | null {
  if (!name.startsWith(DISPARO_LABEL_PREFIX) || !name.endsWith(DISPARO_LABEL_SUFFIX)) return null
  const n = parseInt(name.slice(DISPARO_LABEL_PREFIX.length, -1), 10)
  return isNaN(n) ? null : n
}

export function disparoLabelName(count: number): string {
  return `${DISPARO_LABEL_PREFIX}${count}${DISPARO_LABEL_SUFFIX}`
}

export async function updateDisparoLabels(
  service: ReturnType<typeof createServiceClient>,
  leadIds: string[],
) {
  if (!leadIds.length) return

  const { data: allLabels } = await service.from('labels').select('id, name')
  const typed = (allLabels ?? []) as { id: string; name: string }[]
  const countLabels = typed.filter(l => parseDisparoCount(l.name) !== null)
  const labelByCount = new Map(countLabels.map(l => [parseDisparoCount(l.name)!, l.id]))

  const { data: assignments } = await service
    .from('lead_labels')
    .select('lead_id, label_id')
    .in('lead_id', leadIds)

  const typed2 = (assignments ?? []) as { lead_id: string; label_id: string }[]
  const leadCurrentCount = new Map<string, { labelId: string; count: number }>()
  for (const a of typed2) {
    const label = countLabels.find(l => l.id === a.label_id)
    if (label) {
      leadCurrentCount.set(a.lead_id, {
        labelId: a.label_id,
        count:   parseDisparoCount(label.name)!,
      })
    }
  }

  for (const leadId of leadIds) {
    const current  = leadCurrentCount.get(leadId)
    const newCount = (current?.count ?? 0) + 1

    // Remove old disparo label
    if (current) {
      await service.from('lead_labels').delete()
        .eq('lead_id', leadId).eq('label_id', current.labelId)
    }

    // Get or create label for new count
    let newLabelId = labelByCount.get(newCount)
    if (!newLabelId) {
      const { data: created } = await service
        .from('labels')
        .insert({ name: disparoLabelName(newCount), color: DISPARO_LABEL_COLOR } as never)
        .select('id')
        .single()
      if (created) {
        newLabelId = (created as { id: string }).id
        labelByCount.set(newCount, newLabelId)
      }
    }

    if (newLabelId) {
      const alreadyHas = typed2.some(a => a.lead_id === leadId && a.label_id === newLabelId)
      if (!alreadyHas) {
        await service.from('lead_labels')
          .insert({ lead_id: leadId, label_id: newLabelId } as never)
      }
    }
  }
}

// ── Route handlers ────────────────────────────────────────────────────────────

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
    phones = [],
  } = body

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
