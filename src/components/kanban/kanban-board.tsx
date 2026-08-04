'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface KanbanBoardProps {
  initialLeads: Lead[]
  currentUserId: string
}

export function KanbanBoard({ initialLeads, currentUserId }: KanbanBoardProps) {
  const searchParams = useSearchParams()
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pendingLoss, setPendingLoss] = useState<{ leadId: string; previousStage: KanbanStage } | null>(null)
  const [lossReason, setLossReason] = useState('')
  const [lossDetail, setLossDetail] = useState('')
  const [moving, setMoving] = useState(false)
  const stageFilterParam = searchParams.get('stage')
  const stageFilter = KANBAN_COLUMNS.some(column => column.id === stageFilterParam)
    ? stageFilterParam as KanbanStage
    : null
  const visibleColumns = stageFilter
    ? KANBAN_COLUMNS.filter(column => column.id === stageFilter)
    : KANBAN_COLUMNS

  useEffect(() => {
    const leadId = searchParams.get('lead')
    if (leadId && initialLeads.some(lead => lead.id === leadId)) setSelectedLeadId(leadId)
  }, [initialLeads, searchParams])

  // Derivado — nunca fica stale porque lê diretamente do array autoritativo
  const selectedLead = selectedLeadId ? (leads.find(l => l.id === selectedLeadId) ?? null) : null
  const activeLead = activeId ? (leads.find(l => l.id === activeId) ?? null) : null

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const moveLead = useCallback(async (leadId: string, newStage: KanbanStage, motivoPerda?: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.stage === newStage) return

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: newStage } : l))

    const colLabel = KANBAN_COLUMNS.find(c => c.id === newStage)?.label ?? newStage

    try {
      const res = await fetch(`/api/leads/${leadId}/move-stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage, motivo_perda: motivoPerda }),
      })
      const json = await res.json() as { error?: string }
      if (!res.ok) throw new Error(json.error)
      toast.success(`Lead movido para ${colLabel}`)
    } catch (error) {
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage: lead.stage } : l))
      toast.error(error instanceof Error && error.message ? error.message : 'Erro ao mover lead. Tente novamente.')
    }
  }, [leads])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveId(null)

    const { active, over } = event
    if (!over) return

    const leadId = active.id as string
    const newStage = over.id as KanbanStage
    const lead = leads.find(item => item.id === leadId)
    if (!lead || lead.stage === newStage) return

    if (newStage === 'sem_interesse') {
      setPendingLoss({ leadId, previousStage: lead.stage as KanbanStage })
      setLossReason('')
      setLossDetail('')
      return
    }

    await moveLead(leadId, newStage)
  }, [leads, moveLead])

  const confirmLoss = useCallback(async () => {
    if (!pendingLoss || !lossReason) {
      toast.error('Selecione o motivo')
      return
    }
    setMoving(true)
    const motivo = [lossReason, lossDetail.trim()].filter(Boolean).join(': ')
    await moveLead(pendingLoss.leadId, 'sem_interesse', motivo)
    setMoving(false)
    setPendingLoss(null)
  }, [lossDetail, lossReason, moveLead, pendingLoss])

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
        <div className="flex h-full min-h-0 flex-col gap-2">
          {stageFilter && (
            <div className="flex flex-shrink-0 items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-xs text-ink-muted">
              <span>Exibindo apenas {KANBAN_COLUMNS.find(column => column.id === stageFilter)?.label}</span>
              <Link href="/kanban" className="font-medium text-brand hover:underline">Ver todo o pipeline</Link>
            </div>
          )}
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-1">
            {visibleColumns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                leads={leadsPerStage(col.id)}
                onLeadClick={(lead) => setSelectedLeadId(lead.id)}
              />
            ))}
          </div>
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
        onTogglePause={() => selectedLead && handleTogglePause(selectedLead.id)}
        onLeadUpdated={(updated) => setLeads(prev => prev.map(l => l.id === updated.id ? updated : l))}
        onLeadDeleted={(leadId) => {
          setLeads(prev => prev.filter(l => l.id !== leadId))
          setSelectedLeadId(null)
        }}
        currentUserId={currentUserId}
      />

      <Dialog open={pendingLoss !== null} onOpenChange={open => !open && !moving && setPendingLoss(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Por que este lead não tem interesse?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="block text-sm font-medium text-ink">
              Motivo
              <select value={lossReason} onChange={event => setLossReason(event.target.value)} className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50">
                <option value="">Selecione</option>
                <option>Preço ou condição</option>
                <option>Momento de compra</option>
                <option>Localização ou produto</option>
                <option>Comprou outro imóvel</option>
                <option>Não quer continuar o contato</option>
                <option>Outro</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-ink">
              Complemento
              <textarea value={lossDetail} onChange={event => setLossDetail(event.target.value)} rows={2} placeholder="Detalhe opcional" className="mt-1.5 w-full resize-none rounded-md border border-line-strong bg-surface px-3 py-2 text-sm outline-none focus:border-brand/50" />
            </label>
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setPendingLoss(null)} disabled={moving} className="rounded-md px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-sunken">Cancelar</button>
            <button type="button" onClick={confirmLoss} disabled={moving || !lossReason} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{moving ? 'Movendo...' : 'Mover lead'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
