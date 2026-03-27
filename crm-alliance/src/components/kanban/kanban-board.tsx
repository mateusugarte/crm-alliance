'use client'

import { useState, useCallback } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
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

    // Optimistic update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))

    // Persist to API
    try {
      await fetch(`/api/leads/${leadId}/move-stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })
    } catch {
      // Rollback on error
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: lead.stage } : l))
    }
  }, [leads])

  const leadsPerStage = (stage: KanbanStage) => leads.filter(l => l.stage === stage)

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
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
        onAssume={() => {
          // US-021 — implementado no alliance-backend
        }}
        onTogglePause={() => {
          // US-021 — implementado no alliance-backend
        }}
      />
    </>
  )
}
