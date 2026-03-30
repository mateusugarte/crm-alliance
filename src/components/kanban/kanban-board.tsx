'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import { KanbanColumn } from './kanban-column'
import { LeadCard } from './lead-card'
import { LeadDetailModal } from './lead-detail-modal'
import { KANBAN_COLUMNS, type KanbanStage } from './types'
import type { Lead } from '@/lib/supabase/types'

interface KanbanBoardProps {
  initialLeads: Lead[]
  currentUserId: string
}

export function KanbanBoard({ initialLeads, currentUserId }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  // Derivado — nunca fica stale porque lê diretamente do array autoritativo
  const selectedLead = selectedLeadId ? (leads.find(l => l.id === selectedLeadId) ?? null) : null
  const activeLead = activeId ? (leads.find(l => l.id === activeId) ?? null) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null)

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

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
  }, [])

  const handleTogglePause = useCallback(async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    const newState = !lead.automation_paused
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, automation_paused: newState } : l))
    // selectedLead se atualiza automaticamente por ser derivado

    try {
      const res = await fetch(`/api/leads/${leadId}/pause`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success(newState ? 'IA pausada' : 'IA retomada')
    } catch {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, automation_paused: lead.automation_paused } : l))
      toast.error('Erro ao atualizar automação.')
    }
  }, [leads])

  const handleAssume = useCallback(async (leadId: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return

    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: currentUserId }),
      })
      if (!res.ok) throw new Error()
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, assigned_to: currentUserId } : l))
      toast.success('Lead assumido com sucesso')
    } catch {
      toast.error('Erro ao assumir lead.')
    }
  }, [leads, currentUserId])

  const leadsPerStage = useCallback(
    (stage: KanbanStage) => leads.filter(l => l.stage === stage),
    [leads]
  )

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-3 overflow-x-auto h-full pb-1">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              leads={leadsPerStage(col.id)}
              onLeadClick={(lead) => setSelectedLeadId(lead.id)}
            />
          ))}
        </div>

        <DragOverlay
          dropAnimation={{
            duration: 180,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
        >
          {activeLead ? (
            <LeadCard lead={activeLead} onClick={() => {}} isOverlay />
          ) : null}
        </DragOverlay>
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
