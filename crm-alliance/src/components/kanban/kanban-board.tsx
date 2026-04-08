'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { toast } from 'sonner'
import { Search, ChevronDown } from 'lucide-react'
import { KanbanColumn } from './kanban-column'
import { LeadDetailModal } from './lead-detail-modal'
import { KANBAN_COLUMNS, type KanbanStage } from './types'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from '@/lib/supabase/types'

interface KanbanBoardProps {
  initialLeads: Lead[]
}

type ConsultorFilter = 'todos' | 'ia' | 'consultor'

export function KanbanBoard({ initialLeads }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Derivado: sempre reflete o estado mais recente de leads sem estado duplicado
  const selectedLead = leads.find(l => l.id === selectedLeadId) ?? null

  // Ref para acessar selectedLeadId dentro do callback do Realtime sem recriar o canal
  const selectedLeadIdRef = useRef<string | null>(null)
  selectedLeadIdRef.current = selectedLeadId
  const [consultorFilter, setConsultorFilter] = useState<ConsultorFilter>('todos')
  const [filterOpen, setFilterOpen] = useState(false)
  const [realtimeBadge, setRealtimeBadge] = useState(0)
  const filterRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Wave F — Supabase Realtime no Kanban
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as Lead
            setLeads(prev => {
              if (prev.some(l => l.id === newLead.id)) return prev
              return [newLead, ...prev]
            })
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Lead
            setLeads(prev => {
              const existing = prev.find(l => l.id === updated.id)
              if (existing && existing.stage !== updated.stage) {
                setRealtimeBadge(n => n + 1)
                const colLabel = KANBAN_COLUMNS.find(c => c.id === updated.stage)?.label ?? updated.stage
                toast.info(`${updated.name} movido para ${colLabel}`, { duration: 3000 })
              }
              if (existing && !existing.assigned_to && updated.assigned_to) {
                toast.info(`${updated.name} foi assumido por um consultor`, { duration: 3000 })
              }
              return prev.map(l => l.id === updated.id ? updated : l)
            })
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setLeads(prev => prev.filter(l => l.id !== deleted.id))
            if (deleted.id === selectedLeadIdRef.current) setSelectedLeadId(null)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over) return

    const leadId = active.id as string
    const newStage = over.id as KanbanStage

    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage === newStage) return

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))

    const colLabel = KANBAN_COLUMNS.find(c => c.id === newStage)?.label ?? newStage

    try {
      const res = await fetch(`/api/leads/${leadId}/move-stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
      if (!res.ok) throw new Error()
      toast.success(`Lead movido para ${colLabel}`)
    } catch {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: lead.stage } : l))
      toast.error('Erro ao mover lead. Tente novamente.')
    }
  }, [leads])

  const handleTogglePause = useCallback(async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    const newState = !lead.automation_paused
    // selectedLead e derivado de leads — basta atualizar leads
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, automation_paused: newState } : l))

    try {
      const res = await fetch(`/api/leads/${leadId}/pause`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success(newState ? 'IA pausada' : 'IA retomada')
    } catch {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, automation_paused: lead.automation_paused } : l))
      toast.error('Erro ao atualizar automacao.')
    }
  }, [leads])

  const handleAssume = useCallback(async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, { method: 'POST' })
      if (!res.ok) throw new Error()

      const json = await res.json() as { data: { assigned_to: string; badge_color: string } }
      const { assigned_to } = json.data

      // selectedLead e derivado de leads — basta atualizar leads
      setLeads(prev => prev.map(l =>
        l.id === leadId ? { ...l, assigned_to } : l
      ))

      toast.success('Voce assumiu esta conversa')
    } catch {
      toast.error('Erro ao assumir conversa. Tente novamente.')
    }
  }, [leads])

  const filteredLeads = leads.filter(lead => {
    const matchSearch =
      search === '' ||
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone.includes(search)

    const matchConsultor =
      consultorFilter === 'todos' ||
      (consultorFilter === 'ia' && lead.assigned_to === null) ||
      (consultorFilter === 'consultor' && lead.assigned_to !== null)

    return matchSearch && matchConsultor
  })

  const leadsPerStage = (stage: KanbanStage) => filteredLeads.filter(l => l.stage === stage)

  const filterLabel: Record<ConsultorFilter, string> = {
    todos: 'Todos',
    ia: 'Agente IA',
    consultor: 'Consultor',
  }

  const filterColors: Record<ConsultorFilter, string> = {
    todos: 'bg-gray-100 text-gray-600',
    ia: 'bg-alliance-dark text-white',
    consultor: 'bg-alliance-blue/10 text-alliance-blue',
  }

  return (
    <>
      {/* Barra de busca + filtro */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 flex-1 max-w-xs shadow-sm">
          <Search size={14} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lead por nome..."
            className="flex-1 bg-transparent text-sm text-alliance-dark placeholder-gray-400 outline-none focus-visible:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xs leading-none cursor-pointer"
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </div>

        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setFilterOpen(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue ${
              consultorFilter !== 'todos'
                ? 'border-alliance-blue bg-alliance-blue/5 text-alliance-blue'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                consultorFilter === 'ia'
                  ? 'bg-alliance-dark'
                  : consultorFilter === 'consultor'
                  ? 'bg-alliance-blue'
                  : 'bg-gray-400'
              }`}
            />
            {filterLabel[consultorFilter]}
            <ChevronDown
              size={13}
              className={`transition-transform duration-150 ${filterOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {filterOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-10 min-w-[140px]">
              {(['todos', 'ia', 'consultor'] as ConsultorFilter[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => { setConsultorFilter(opt); setFilterOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors cursor-pointer hover:bg-gray-50 ${
                    consultorFilter === opt ? 'font-semibold text-alliance-dark' : 'text-gray-600'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${filterColors[opt].split(' ')[0]}`} />
                  {filterLabel[opt]}
                </button>
              ))}
            </div>
          )}
        </div>

        {realtimeBadge > 0 && (
          <button
            onClick={() => setRealtimeBadge(0)}
            className="flex items-center gap-1.5 px-3 py-2 bg-alliance-blue text-white text-sm font-medium rounded-xl cursor-pointer hover:bg-alliance-blue/90 transition-colors animate-pulse"
            title="Clique para dispensar"
          >
            <span className="w-4 h-4 bg-white text-alliance-blue rounded-full text-xs font-bold flex items-center justify-center leading-none">
              {realtimeBadge > 9 ? '9+' : realtimeBadge}
            </span>
            atualiz. ao vivo
          </button>
        )}

        {(search || consultorFilter !== 'todos') && (
          <span className="text-xs text-gray-400 ml-auto">
            {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} encontrado{filteredLeads.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto h-full pb-1">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              leads={leadsPerStage(col.id)}
              allLeads={filteredLeads}
              onLeadClick={(lead) => setSelectedLeadId(lead.id)}
            />
          ))}
        </div>
      </DndContext>

      <LeadDetailModal
        lead={selectedLead}
        open={selectedLead !== null}
        onClose={() => setSelectedLeadId(null)}
        onAssume={() => selectedLead && handleAssume(selectedLead.id)}
        onTogglePause={() => selectedLead && handleTogglePause(selectedLead.id)}
      />
    </>
  )
}
