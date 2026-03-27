import PageTransition from '@/components/layout/page-transition'
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

    const [{ data: meetingData }, { data: leadsData }] = await Promise.all([
      supabase
        .from('meetings')
        .select('id, datetime, lead_id, assigned_to')
        .eq('status', 'scheduled'),
      supabase
        .from('leads')
        .select('id, name, phone')
        .order('name', { ascending: true }),
    ])

    const leads = (leadsData as LeadRow[] | null) ?? []

    if (!meetingData) return { meetings: [], leads }

    const meetingRows = meetingData as { id: string; datetime: string; lead_id: string; assigned_to: string | null }[]
    const profileIds = [...new Set(meetingRows.map(m => m.assigned_to).filter((x): x is string => x !== null))]

    const { data: profiles } = profileIds.length > 0
      ? await supabase.from('user_profiles').select('id, full_name, badge_color').in('id', profileIds)
      : { data: [] }

    const leadMap = new Map(leads.map(l => [l.id, l.name]))
    const profileMap = new Map((profiles ?? []).map((p: { id: string; full_name: string; badge_color: string }) => [p.id, p]))

    const meetings: MeetingWithLead[] = meetingRows.map(m => {
      const profile = m.assigned_to ? profileMap.get(m.assigned_to) : null
      return {
        id: m.id,
        datetime: m.datetime,
        lead_name: leadMap.get(m.lead_id) ?? 'Lead',
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
    <PageTransition>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-alliance-dark">Agenda</h1>
        <AgendaClient meetings={meetings} leads={leads} />
      </div>
    </PageTransition>
  )
}
