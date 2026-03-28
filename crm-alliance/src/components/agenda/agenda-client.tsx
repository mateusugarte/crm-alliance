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
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react'
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
    try {
      const res = await fetch('/api/meetings')
      if (res.ok) {
        const json = await res.json() as { data: Array<{ id: string; datetime: string; lead_id: string; assigned_to: string | null }> }
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

  const totalMeetingsThisMonth = meetings.filter(m => {
    const d = new Date(m.datetime)
    return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear()
  }).length

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-200 shadow-sm p-1">
            <button
              onClick={() => setCurrentDate(d => subMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={18} className="text-alliance-dark" />
            </button>
            <span className="font-bold text-alliance-dark px-3 min-w-36 text-center text-sm">
              {monthLabel}
            </span>
            <button
              onClick={() => setCurrentDate(d => addMonths(d, 1))}
              className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={18} className="text-alliance-dark" />
            </button>
          </div>

          {totalMeetingsThisMonth > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-xl">
              <Calendar size={13} className="text-alliance-blue" />
              {totalMeetingsThisMonth} reuniões
            </span>
          )}
        </div>

        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors shadow-sm"
        >
          <Plus size={15} />
          Nova Reunião
        </button>
      </div>

      {/* Calendário */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Cabeçalhos dos dias */}
        <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50">
          {DAY_HEADERS.map(d => (
            <div key={d} className="py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Células */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dayMeetings = meetingsForDay(day)
            const today = isToday(day)
            const inMonth = isSameMonth(day, currentDate)

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[100px] p-2 border-b border-r border-gray-50 transition-colors ${
                  !inMonth ? 'bg-gray-50/60' : today ? 'bg-alliance-blue/3' : ''
                }`}
              >
                <div className="flex items-center justify-end mb-1.5">
                  <span
                    className={`text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                      today
                        ? 'bg-alliance-blue text-white shadow-sm'
                        : inMonth
                        ? 'text-alliance-dark hover:bg-gray-100'
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
                    <span className="text-xs text-alliance-blue font-medium pl-1 cursor-pointer hover:underline">
                      +{dayMeetings.length - 2} mais
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
