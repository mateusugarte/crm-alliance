'use client'

import { useState, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { toast } from 'sonner'
import { KanbanColumn } from './kanban-column'
import { LeadDetailModal } from './lead-detail-modal'
import { KANBAN_COLUMNS, type KanbanStage } from './types'
import type { Lead } from '@/lib/supabase/types'

interface KanbanBoardProps {
  initialLeads: Lead[]
}

export function KanbanBoard({ initialLeads }: KanbanBoardProps) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, automation_paused: newState } : l))
    if (selectedLead?.id === leadId) {
      setSelectedLead(prev => prev ? { ...prev, automation_paused: newState } : null)
    }

    try {
      const res = await fetch(`/api/leads/${leadId}/pause`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success(newState ? 'IA pausada' : 'IA retomada')
    } catch {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, automation_paused: lead.automation_paused } : l))
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, automation_paused: lead.automation_paused } : null)
      }
      toast.error('Erro ao atualizar automação.')
    }
  }, [leads, selectedLead])

  const leadsPerStage = (stage: KanbanStage) => leads.filter(l => l.stage === stage)

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto h-full pb-1">
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              leads={leadsPerStage(col.id)}
              onLeadClick={setSelectedLead}
            />
          ))}
        </div>
      </DndContext>

      <LeadDetailModal
        lead={selectedLead}
        open={selectedLead !== null}
        onClose={() => setSelectedLead(null)}
        onAssume={() => {}}
        onTogglePause={() => selectedLead && handleTogglePause(selectedLead.id)}
      />
    </>
  )
}
