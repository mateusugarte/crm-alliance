'use client'

import { useState, useMemo } from 'react'
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
  setHours,
  setMinutes,
  getHours,
  getMinutes,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import type { MeetingWithLead } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  name: string
  phone: string
}

interface MeetingFormPanelProps {
  open: boolean
  onClose: () => void
  leads: Lead[]
  prefillLeadId?: string
  editMeeting?: MeetingWithLead
  onSaved: (meeting: MeetingWithLead) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_HEADERS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function buildTimeSlots(): string[] {
  const slots: string[] = []
  for (let h = 7; h <= 21; h++) {
    slots.push(`${String(h).padStart(2, '0')}:00`)
    if (h < 21) slots.push(`${String(h).padStart(2, '0')}:30`)
  }
  return slots
}

const TIME_SLOTS = buildTimeSlots()

// ─── Mini Calendar ────────────────────────────────────────────────────────────

interface MiniCalendarProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
}

function MiniCalendar({ selectedDate, onSelectDate }: MiniCalendarProps) {
  const [viewDate, setViewDate] = useState(() => startOfMonth(selectedDate))

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewDate)
    const monthEnd = endOfMonth(viewDate)
    const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
    return eachDayOfInterval({ start: calStart, end: calEnd })
  }, [viewDate])

  const monthLabel = format(viewDate, 'MMMM yyyy', { locale: ptBR })
    .replace(/^\w/, c => c.toUpperCase())

  return (
    <div className="bg-gray-50 rounded-2xl p-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setViewDate(d => subMonths(d, 1))}
          className="p-1 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <ChevronLeft size={16} className="text-alliance-dark" />
        </button>
        <span className="text-sm font-bold text-alliance-dark">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setViewDate(d => addMonths(d, 1))}
          className="p-1 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
        >
          <ChevronRight size={16} className="text-alliance-dark" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {days.map(day => {
          const inMonth = isSameMonth(day, viewDate)
          const selected = isSameDay(day, selectedDate)
          const todayDay = isToday(day)

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={!inMonth}
              onClick={() => inMonth && onSelectDate(day)}
              className={cn(
                'w-8 h-8 flex items-center justify-center rounded-full text-xs transition-colors mx-auto',
                !inMonth && 'text-gray-300 cursor-default',
                inMonth && !selected && !todayDay && 'text-gray-700 hover:bg-gray-200 cursor-pointer',
                inMonth && todayDay && !selected && 'bg-alliance-blue/10 text-alliance-blue font-semibold cursor-pointer',
                selected && 'bg-alliance-dark text-white font-bold cursor-pointer',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Time Grid ────────────────────────────────────────────────────────────────

interface TimeGridProps {
  selectedTime: string
  onSelectTime: (time: string) => void
}

function TimeGrid({ selectedTime, onSelectTime }: TimeGridProps) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Horário</p>
      <div className="flex flex-wrap gap-1.5">
        {TIME_SLOTS.map(slot => (
          <button
            key={slot}
            type="button"
            onClick={() => onSelectTime(slot)}
            className={cn(
              'text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
              selectedTime === slot
                ? 'bg-alliance-dark text-white border-alliance-dark'
                : 'border-gray-200 text-gray-600 hover:border-alliance-blue hover:text-alliance-blue',
            )}
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Lead Search ──────────────────────────────────────────────────────────────

interface LeadSearchProps {
  leads: Lead[]
  selectedLeadId: string
  onSelect: (lead: Lead) => void
  onClear: () => void
  disabled?: boolean
}

function LeadSearch({ leads, selectedLeadId, onSelect, onClear, disabled }: LeadSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selectedLead = leads.find(l => l.id === selectedLeadId)

  const filtered = useMemo(() => {
    if (!query.trim()) return leads.slice(0, 8)
    const q = query.toLowerCase()
    return leads.filter(l =>
      l.name.toLowerCase().includes(q) || l.phone.includes(q)
    ).slice(0, 8)
  }, [leads, query])

  if (selectedLead) {
    if (disabled) {
      return (
        <div className="flex items-center gap-2 bg-alliance-blue/5 border border-alliance-blue/20 rounded-xl px-3 py-2.5">
          <span className="text-sm font-medium text-alliance-dark truncate">{selectedLead.name}</span>
          <span className="text-xs text-gray-400 truncate">{selectedLead.phone}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-2 bg-alliance-blue/5 border border-alliance-blue/20 rounded-xl px-3 py-2.5">
        <span className="text-sm font-medium text-alliance-dark flex-1 truncate">{selectedLead.name}</span>
        <span className="text-xs text-gray-400 truncate">{selectedLead.phone}</span>
        <button
          type="button"
          onClick={onClear}
          className="ml-1 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Limpar lead selecionado"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar lead pelo nome ou telefone..."
        className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue placeholder:text-gray-400"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10 max-h-48 overflow-y-auto">
          {filtered.map(lead => (
            <button
              key={lead.id}
              type="button"
              onMouseDown={() => { onSelect(lead); setQuery(''); setOpen(false) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <span className="text-sm font-medium text-gray-800 flex-1 truncate">{lead.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{lead.phone}</span>
            </button>
          ))}
        </div>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-lg z-10 px-3 py-2.5">
          <span className="text-sm text-gray-400">Nenhum lead encontrado.</span>
        </div>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MeetingFormPanel({
  open,
  onClose,
  leads,
  prefillLeadId,
  editMeeting,
  onSaved,
}: MeetingFormPanelProps) {
  const isEdit = Boolean(editMeeting)

  const initialDate = editMeeting
    ? new Date(editMeeting.datetime)
    : new Date()

  const initialTime = editMeeting
    ? format(new Date(editMeeting.datetime), 'HH:mm')
    : '09:00'

  const [selectedLeadId, setSelectedLeadId] = useState(
    editMeeting?.lead_id ?? prefillLeadId ?? ''
  )
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate)
  const [selectedTime, setSelectedTime] = useState(initialTime)
  const [notes, setNotes] = useState(editMeeting?.notes ?? '')
  const [loading, setLoading] = useState(false)

  // Reset state when panel opens/closes
  const handleClose = () => {
    setSelectedLeadId(editMeeting?.lead_id ?? prefillLeadId ?? '')
    setSelectedDate(initialDate)
    setSelectedTime(initialTime)
    setNotes(editMeeting?.notes ?? '')
    setLoading(false)
    onClose()
  }

  const buildDatetime = (): string => {
    const [h, m] = selectedTime.split(':').map(Number)
    const dt = setMinutes(setHours(selectedDate, h), m)
    return dt.toISOString()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isEdit && !selectedLeadId) {
      toast.error('Selecione um lead para continuar.')
      return
    }

    if (!selectedTime) {
      toast.error('Selecione um horário para a reunião.')
      return
    }

    setLoading(true)

    try {
      const datetime = buildDatetime()

      if (isEdit && editMeeting) {
        const res = await fetch(`/api/meetings/${editMeeting.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            datetime,
            notes: notes.trim() || null,
          }),
        })

        if (!res.ok) {
          const json = await res.json() as { error?: string }
          toast.error(json.error ?? 'Erro ao salvar reunião')
          return
        }

        const json = await res.json() as { data: { id: string; datetime: string; notes: string | null; status: string; lead_id: string; assigned_to: string | null } }
        const saved: MeetingWithLead = {
          ...editMeeting,
          datetime: json.data.datetime,
          notes: json.data.notes,
          status: json.data.status as MeetingWithLead['status'],
        }
        toast.success('Reunião atualizada!')
        onSaved(saved)
        handleClose()
      } else {
        const res = await fetch('/api/meetings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: selectedLeadId,
            datetime,
            notes: notes.trim() || null,
          }),
        })

        if (!res.ok) {
          const json = await res.json() as { error?: string }
          toast.error(json.error ?? 'Erro ao criar reunião')
          return
        }

        const json = await res.json() as { data: { id: string } }
        const lead = leads.find(l => l.id === selectedLeadId)
        const saved: MeetingWithLead = {
          id: json.data.id,
          datetime,
          notes: notes.trim() || null,
          status: 'scheduled',
          lead_id: selectedLeadId,
          lead_name: lead?.name ?? 'Lead',
          lead_phone: lead?.phone ?? '',
          assigned_to: null,
          consultant_name: 'Consultor',
          consultant_color: '#0A2EAD',
        }
        toast.success('Reunião criada!')
        onSaved(saved)
        handleClose()
      }
    } catch {
      toast.error('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectDate = (day: Date) => {
    const [h, m] = selectedTime.split(':').map(Number)
    setSelectedDate(setMinutes(setHours(day, h), m))
  }

  const selectedDateLabel = format(selectedDate, "d 'de' MMMM 'de' yyyy", { locale: ptBR })

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) handleClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ width: 480, maxWidth: 480 }}
        className="p-0 overflow-y-auto flex flex-col gap-0"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex-shrink-0" style={{ backgroundColor: '#0A2EAD' }}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CalendarDays size={18} className="text-white/80 flex-shrink-0" />
              <h2 className="text-lg font-bold text-white leading-tight">
                {isEdit ? 'Editar Reunião' : 'Nova Reunião'}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="text-white/60 hover:text-white transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 flex-shrink-0 cursor-pointer"
              aria-label="Fechar painel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1">
          <div className="flex flex-col gap-0 flex-1">

            {/* Seção 1 — Lead */}
            <div className="px-6 py-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Lead</p>
              <LeadSearch
                leads={leads}
                selectedLeadId={selectedLeadId}
                onSelect={lead => setSelectedLeadId(lead.id)}
                onClear={() => setSelectedLeadId('')}
                disabled={isEdit}
              />
            </div>

            <div className="border-t border-gray-100" />

            {/* Seção 2 — Data e Hora */}
            <div className="px-6 py-5 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Data e Hora</p>
                <span className="text-xs font-medium text-alliance-dark">
                  {selectedDateLabel} — {selectedTime}
                </span>
              </div>

              <MiniCalendar
                selectedDate={selectedDate}
                onSelectDate={handleSelectDate}
              />

              <TimeGrid
                selectedTime={selectedTime}
                onSelectTime={time => {
                  setSelectedTime(time)
                  const [h, m] = time.split(':').map(Number)
                  setSelectedDate(d => setMinutes(setHours(d, h), m))
                }}
              />
            </div>

            <div className="border-t border-gray-100" />

            {/* Seção 3 — Observações */}
            <div className="px-6 py-5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Observações</p>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex: Reunião via Google Meet, link enviado pelo WhatsApp..."
                rows={3}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-alliance-blue placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-alliance-dark rounded-xl hover:bg-alliance-dark/90 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar Reunião'}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
