'use client'

import { useState } from 'react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { MeetingPill } from './meeting-pill'
import { CreateMeetingDialog } from './create-meeting-dialog'
import type { MeetingWithLead } from './types'

const DAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

interface Lead {
  id: string
  name: string
  phone: string
}

interface AgendaClientProps {
  meetings: MeetingWithLead[]
  leads: Lead[]
}

export function AgendaClient({ meetings: initialMeetings, leads }: AgendaClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [meetings, setMeetings] = useState(initialMeetings)
  const [dialogOpen, setDialogOpen] = useState(false)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const meetingsForDay = (day: Date) =>
    meetings.filter(m => isSameDay(new Date(m.datetime), day))

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
    .replace(/^\w/, c => c.toUpperCase())

  const handleMeetingCreated = async () => {
    // Refetch meetings after creation
    try {
      const res = await fetch('/api/meetings')
      if (res.ok) {
        const json = await res.json() as { data: Array<{ id: string; datetime: string; lead_id: string; assigned_to: string | null }> }
        // Update with available data (simplified, without lead name lookup)
        const updated = json.data.map(m => ({
          id: m.id,
          datetime: m.datetime,
          lead_name: leads.find(l => l.id === m.lead_id)?.name ?? 'Lead',
          consultant_name: 'Consultor',
          consultant_color: '#0A2EAD',
        }))
        setMeetings(updated)
      }
    } catch {
      // Keep existing meetings on error
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header do calendário */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(d => subMonths(d, 1))}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft size={20} className="text-alliance-dark" />
          </button>
          <h2 className="text-lg font-bold text-alliance-dark">{monthLabel}</h2>
          <button
            onClick={() => setCurrentDate(d => addMonths(d, 1))}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <ChevronRight size={20} className="text-alliance-dark" />
          </button>
        </div>

        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors"
        >
          <Plus size={16} />
          Nova Reunião
        </button>
      </div>

      {/* Grid */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_HEADERS.map(d => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-gray-500">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayMeetings = meetingsForDay(day)
            const today = isToday(day)
            const inMonth = isSameMonth(day, currentDate)

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[90px] p-1.5 border-b border-r border-gray-50 ${
                  !inMonth ? 'bg-gray-50/50' : ''
                }`}
              >
                <div className="flex items-center justify-end mb-1">
                  <span
                    className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                      today
                        ? 'bg-alliance-blue text-white'
                        : inMonth
                        ? 'text-alliance-dark'
                        : 'text-gray-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayMeetings.slice(0, 2).map(m => (
                    <MeetingPill key={m.id} meeting={m} />
                  ))}
                  {dayMeetings.length > 2 && (
                    <span className="text-xs text-gray-400 pl-1">
                      +{dayMeetings.length - 2}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <CreateMeetingDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        leads={leads}
        onCreated={handleMeetingCreated}
      />
    </div>
  )
}
