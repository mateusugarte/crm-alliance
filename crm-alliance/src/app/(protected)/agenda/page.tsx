import PageTransition from '@/components/layout/page-transition'
import { ErrorState } from '@/components/layout/error-state'
import { AgendaClient } from '@/components/agenda/agenda-client'
import type { MeetingWithLead } from '@/components/agenda/types'

interface LeadRow {
  id: string
  name: string
  phone: string
}

type AgendaResult =
  | { ok: true; meetings: MeetingWithLead[]; leads: LeadRow[] }
  | { ok: false }

async function getAgendaData(): Promise<AgendaResult> {
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()

    const [{ data: meetingData, error: mtgErr }, { data: leadsData, error: leadErr }] = await Promise.all([
      supabase
        .from('meetings')
        .select('id, datetime, lead_id, assigned_to')
        .eq('status', 'scheduled'),
      supabase
        .from('leads')
        .select('id, name, phone')
        .order('name', { ascending: true }),
    ])

    if (mtgErr || leadErr) return { ok: false }

    const leads = (leadsData as LeadRow[] | null) ?? []

    if (!meetingData) return { ok: true, meetings: [], leads }

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

    return { ok: true, meetings, leads }
  } catch {
    return { ok: false }
  }
}

export default async function AgendaPage() {
  const result = await getAgendaData()

  return (
    <PageTransition>
      <div className="px-8 py-7 flex flex-col gap-6">
        <div>
          {/* Eyebrow: text-label semântico */}
          <p className="text-label text-alliance-blue/60 uppercase tracking-widest mb-1">
            Reunioes
          </p>
          {/* Título de página: text-title semântico */}
          <h1 className="text-title text-alliance-dark">Agenda</h1>
        </div>

        {!result.ok ? (
          <ErrorState
            title="Erro ao carregar agenda"
            description="Nao foi possivel buscar as reunioes. Recarregue a pagina para tentar novamente."
          />
        ) : (
          <AgendaClient meetings={result.meetings} leads={result.leads} />
        )}
      </div>
    </PageTransition>
  )
}
