import { createServiceClient } from '@/lib/supabase/service'

type ServiceClient = ReturnType<typeof createServiceClient>

type ReactivationDispatchSnapshotInput = {
  id: string
  lead_id: string | null
  phone: string
  message_sent?: string | null
  created_at?: string | null
}

type CampaignDispatchSnapshotInput = {
  id: string
  phone: string
  message_sent?: string | null
  created_at?: string | null
}

type LeadSnapshotData = {
  id: string
  phone: string
  stage: string | null
  reactivation_count: number | null
}

function normalizePhone(phone: string) {
  return phone.replace('@s.whatsapp.net', '').replace(/\D/g, '')
}

export async function createReactivationSnapshots(
  service: ServiceClient,
  campaignId: string,
  dispatches: ReactivationDispatchSnapshotInput[],
) {
  if (!dispatches.length) return

  const leadIds = dispatches
    .map(d => d.lead_id)
    .filter((id): id is string => !!id)

  const leadMap = new Map<string, LeadSnapshotData>()
  if (leadIds.length) {
    const { data } = await service
      .from('leads')
      .select('id, phone, stage, reactivation_count')
      .in('id', leadIds)

    for (const lead of (data ?? []) as LeadSnapshotData[]) {
      leadMap.set(lead.id, lead)
    }
  }

  const rows = dispatches.map(dispatch => {
    const lead = dispatch.lead_id ? leadMap.get(dispatch.lead_id) : null

    return {
      campaign_type: 'reactivation',
      reactivation_campaign_id: campaignId,
      reactivation_dispatch_id: dispatch.id,
      lead_id: dispatch.lead_id,
      phone: dispatch.phone,
      message_sent: dispatch.message_sent ?? null,
      stage_at_impact: lead?.stage ?? null,
      stage_current: lead?.stage ?? null,
      impact_count_at_snapshot: lead?.reactivation_count ?? null,
      impacted_at: dispatch.created_at ?? new Date().toISOString(),
    }
  })

  await service
    .from('disparo_lead_snapshots')
    .insert(rows as never)
}

export async function createCampaignSnapshots(
  service: ServiceClient,
  campaignId: string,
  dispatches: CampaignDispatchSnapshotInput[],
) {
  if (!dispatches.length) return

  const { data } = await service
    .from('leads')
    .select('id, phone, stage, reactivation_count')

  const leadByPhone = new Map<string, LeadSnapshotData>()
  for (const lead of (data ?? []) as LeadSnapshotData[]) {
    leadByPhone.set(normalizePhone(lead.phone), lead)
  }

  const rows = dispatches.map(dispatch => {
    const lead = leadByPhone.get(normalizePhone(dispatch.phone))

    return {
      campaign_type: 'campaign',
      campaign_id: campaignId,
      dispatch_id: dispatch.id,
      lead_id: lead?.id ?? null,
      phone: dispatch.phone,
      message_sent: dispatch.message_sent ?? null,
      stage_at_impact: lead?.stage ?? null,
      stage_current: lead?.stage ?? null,
      impact_count_at_snapshot: lead?.reactivation_count ?? null,
      impacted_at: dispatch.created_at ?? new Date().toISOString(),
    }
  })

  await service
    .from('disparo_lead_snapshots')
    .insert(rows as never)
}

