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
  isFuture,
  isAfter,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Plus, Calendar, Pencil, Trash2, Loader2, User } from 'lucide-react'
import { toast } from 'sonner'
import { MeetingPill } from './meeting-pill'
import { MeetingFormPanel } from './meeting-form-panel'
import { cn } from '@/lib/utils'
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

const STATUS_CONFIG = {
  scheduled: { label: 'Agendada', bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' },
  completed: { label: 'Concluída', bg: 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-white/50' },
  cancelled: { label: 'Cancelada', bg: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400' },
} satisfies Record<MeetingWithLead['status'], { label: string; bg: string }>

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

function MeetingCard({
  meeting,
  onEdit,
  onDelete,
}: {
  meeting: MeetingWithLead
  onEdit: (m: MeetingWithLead) => void
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        toast.error(json.error ?? 'Erro ao excluir')
        return
      }
      toast.success('Reunião excluída')
      onDelete(meeting.id)
    } catch {
      toast.error('Erro inesperado.')
    } finally {
      setDeleting(false)
    }
  }

  const status = STATUS_CONFIG[meeting.status]

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/8 bg-white dark:bg-white/5 p-3 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-gray-800 dark:text-white truncate">{meeting.lead_name}</p>
          <p className="text-xs text-gray-400 dark:text-white/40 mt-0.5">{meeting.lead_phone}</p>
        </div>
        <span className="text-base font-bold tabular-nums text-alliance-dark dark:text-alliance-blue flex-shrink-0">
          {format(new Date(meeting.datetime), 'HH:mm', { locale: ptBR })}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
            style={{ backgroundColor: meeting.consultant_color }}
          >
            {getInitials(meeting.consultant_name) || <User size={9} />}
          </div>
          <span className="text-xs text-gray-500 dark:text-white/50">{meeting.consultant_name}</span>
        </div>
        <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', status.bg)}>
          {status.label}
        </span>
      </div>

      {meeting.notes && (
        <p className="text-xs text-gray-500 dark:text-white/40 bg-gray-50 dark:bg-white/5 rounded-lg px-2.5 py-2 leading-relaxed">
          {meeting.notes}
        </p>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          onClick={() => onEdit(meeting)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-gray-600 dark:text-white/60 border border-gray-200 dark:border-white/10 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer"
        >
          <Pencil size={11} />
          Editar
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors cursor-pointer disabled:opacity-50"
        >
          {deleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
          Excluir
        </button>
      </div>
    </div>
  )
}

export function AgendaClient({ meetings: initialMeetings, leads }: AgendaClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [meetings, setMeetings] = useState(initialMeetings)
  const [selectedDay, setSelectedDay] = useState<Date | null>(new Date())
  const [editingMeeting, setEditingMeeting] = useState<MeetingWithLead | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const meetingsForDay = (day: Date) =>
    meetings.filter(m => isSameDay(new Date(m.datetime), day))

  const monthLabel = format(currentDate, 'MMMM yyyy', { locale: ptBR })
    .replace(/^\w/, c => c.toUpperCase())

  // Painel direita: reuniões do dia selecionado ou próximas reuniões
  const panelMeetings = selectedDay
    ? meetingsForDay(selectedDay).sort((a, b) => a.datetime.localeCompare(b.datetime))
    : meetings
        .filter(m => isFuture(new Date(m.datetime)) || isAfter(new Date(m.datetime), new Date()))
        .sort((a, b) => a.datetime.localeCompare(b.datetime))
        .slice(0, 10)

  const panelTitle = selectedDay
    ? format(selectedDay, "EEEE, d 'de' MMMM", { locale: ptBR }).replace(/^\w/, c => c.toUpperCase())
    : 'Próximas Reuniões'

  const handleSaved = (saved: MeetingWithLead) => {
    if (editingMeeting) {
      setMeetings(prev => prev.map(m => m.id === saved.id ? saved : m))
    } else {
      setMeetings(prev => [...prev, saved])
    }
    setFormOpen(false)
    setEditingMeeting(null)
  }

  const handleEdit = (m: MeetingWithLead) => {
    setEditingMeeting(m)
    setFormOpen(true)
  }

  const handleDeleted = (id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id))
  }

  const handleOpenNew = () => {
    setEditingMeeting(null)
    setFormOpen(true)
  }

  const goToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setSelectedDay(today)
  }

  return (
    <div className="flex gap-4 flex-1 overflow-hidden">
      {/* Calendário */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-white dark:bg-white/8 rounded-xl border border-gray-200 dark:border-white/10 shadow-sm p-1">
              <button
                onClick={() => setCurrentDate(d => subMonths(d, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ChevronLeft size={16} className="text-alliance-dark dark:text-white/70" />
              </button>
              <span className="font-bold text-alliance-dark dark:text-white/90 px-3 min-w-36 text-center text-sm">
                {monthLabel}
              </span>
              <button
                onClick={() => setCurrentDate(d => addMonths(d, 1))}
                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ChevronRight size={16} className="text-alliance-dark dark:text-white/70" />
              </button>
            </div>

            <button
              onClick={goToday}
              className="px-3 py-2 text-xs font-semibold text-alliance-dark dark:text-white/70 bg-white dark:bg-white/8 border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/12 transition-colors cursor-pointer"
            >
              Hoje
            </button>

            {meetings.length > 0 && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-white/40 bg-white dark:bg-white/8 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-xl">
                <Calendar size={12} className="text-alliance-blue" />
                {meetings.length} reuniões
              </span>
            )}
          </div>

          <button
            onClick={handleOpenNew}
            className="flex items-center gap-2 px-4 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors shadow-sm cursor-pointer"
          >
            <Plus size={14} />
            Nova Reunião
          </button>
        </div>

        {/* Grid calendário */}
        <div className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/8 overflow-hidden flex-1">
          {/* Headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/3">
            {DAY_HEADERS.map(d => (
              <div key={d} className="py-2.5 text-center text-xs font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider">
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
              const isSelected = selectedDay ? isSameDay(day, selectedDay) : false

              return (
                <div
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={cn(
                    'min-h-[110px] p-2 border-b border-r border-gray-50 dark:border-white/5 transition-colors cursor-pointer',
                    !inMonth && 'bg-gray-50/60 dark:bg-white/1',
                    today && !isSelected && 'bg-alliance-blue/3 dark:bg-alliance-blue/5',
                    isSelected && 'bg-alliance-blue/8 dark:bg-alliance-blue/10',
                    inMonth && !today && !isSelected && 'hover:bg-gray-50 dark:hover:bg-white/3',
                  )}
                >
                  <div className="flex items-center justify-end mb-1.5">
                    <span
                      className={cn(
                        'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full transition-colors',
                        today
                          ? 'bg-alliance-blue text-white shadow-sm'
                          : isSelected
                          ? 'bg-alliance-dark dark:bg-alliance-blue text-white'
                          : inMonth
                          ? 'text-alliance-dark dark:text-white/80 hover:bg-gray-100 dark:hover:bg-white/10'
                          : 'text-gray-300 dark:text-white/20',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayMeetings.slice(0, 2).map(m => (
                      <MeetingPill
                        key={m.id}
                        meeting={m}
                        onClick={() => setSelectedDay(day)}
                      />
                    ))}
                    {dayMeetings.length > 2 && (
                      <span className="text-[10px] text-alliance-blue font-semibold pl-1">
                        +{dayMeetings.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Painel direita */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-3 overflow-hidden">
        {/* Header do painel */}
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-white/30 uppercase tracking-widest">
              {selectedDay ? format(selectedDay, 'MMMM', { locale: ptBR }).replace(/^\w/, c => c.toUpperCase()) : 'Agenda'}
            </p>
            <h2 className="font-bold text-gray-800 dark:text-white text-sm leading-tight mt-0.5 capitalize">
              {panelTitle}
            </h2>
          </div>
          {selectedDay && (
            <button
              onClick={handleOpenNew}
              className="w-7 h-7 rounded-xl bg-alliance-dark text-white flex items-center justify-center hover:bg-alliance-dark/90 transition-colors cursor-pointer flex-shrink-0"
              title="Nova reunião neste dia"
            >
              <Plus size={13} />
            </button>
          )}
        </div>

        {/* Lista de reuniões */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-0.5">
          {panelMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/8 flex items-center justify-center mb-3">
                <Calendar size={20} className="text-gray-300 dark:text-white/20" />
              </div>
              <p className="text-sm font-medium text-gray-400 dark:text-white/30">
                {selectedDay ? 'Nenhuma reunião' : 'Sem próximas reuniões'}
              </p>
              {selectedDay && (
                <button
                  onClick={handleOpenNew}
                  className="mt-3 text-xs font-semibold text-alliance-blue hover:underline cursor-pointer"
                >
                  + Agendar reunião
                </button>
              )}
            </div>
          ) : (
            panelMeetings.map(m => (
              <MeetingCard
                key={m.id}
                meeting={m}
                onEdit={handleEdit}
                onDelete={handleDeleted}
              />
            ))
          )}
        </div>
      </div>

      {/* Form panel */}
      <MeetingFormPanel
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingMeeting(null) }}
        leads={leads}
        editMeeting={editingMeeting ?? undefined}
        onSaved={handleSaved}
      />
    </div>
  )
}
