import { AgendaClient } from '@/components/agenda/agenda-client'
import type { MeetingWithLead } from '@/components/agenda/types'

interface LeadRow {
  id: string
  name: string
  phone: string
}

async function getAgendaData(): Promise<{
  meetings: MeetingWithLead[]
  leads: LeadRow[]
}> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const [meetingsRes, leadsRes] = await Promise.all([
      supabase
        .from('meetings')
        .select('id, datetime, lead_id, assigned_to, notes, status')
        .eq('status', 'scheduled')
        .order('datetime', { ascending: true }),
      supabase
        .from('leads')
        .select('id, name, phone')
        .order('name', { ascending: true }),
    ])

    const leads = (leadsRes.data as LeadRow[] | null) ?? []

    if (!meetingsRes.data) return { meetings: [], leads }

    const meetingRows = meetingsRes.data as {
      id: string
      datetime: string
      lead_id: string
      assigned_to: string | null
      notes: string | null
      status: string
    }[]

    const profileIds = [
      ...new Set(
        meetingRows.map(m => m.assigned_to).filter((x): x is string => x !== null)
      ),
    ]

    const { data: profiles } = profileIds.length > 0
      ? await supabase
          .from('user_profiles')
          .select('id, full_name, badge_color')
          .in('id', profileIds)
      : { data: [] }

    const leadsMap = new Map(leads.map(l => [l.id, l]))
    const profileMap = new Map(
      (profiles ?? []).map((p: { id: string; full_name: string; badge_color: string }) => [p.id, p])
    )

    const meetings: MeetingWithLead[] = meetingRows.map(m => {
      const lead = leadsMap.get(m.lead_id)
      const profile = m.assigned_to ? profileMap.get(m.assigned_to) : null
      return {
        id: m.id,
        datetime: m.datetime,
        notes: m.notes ?? null,
        status: m.status as MeetingWithLead['status'],
        lead_id: m.lead_id,
        lead_name: lead?.name ?? 'Lead',
        lead_phone: lead?.phone ?? '',
        assigned_to: m.assigned_to,
        consultant_name: profile?.full_name ?? 'agente de IA',
        consultant_color: profile?.badge_color ?? '#0A2EAD',
      }
    })

    return { meetings, leads }
  } catch {
    return { meetings: [], leads: [] }
  }
}

export default async function AgendaPage() {
  const { meetings, leads } = await getAgendaData()

  return (
    <div className="px-8 py-7 flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold text-alliance-blue/60 uppercase tracking-widest mb-1">
          Reuniões
        </p>
        <h1 className="text-2xl font-bold text-alliance-dark">Agenda</h1>
      </div>
      <AgendaClient meetings={meetings} leads={leads} />
    </div>
  )
}
