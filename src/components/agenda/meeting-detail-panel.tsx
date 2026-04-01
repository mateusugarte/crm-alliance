'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarDays, User, Pencil, Trash2, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { MeetingWithLead } from './types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingDetailPanelProps {
  meeting: MeetingWithLead | null
  open: boolean
  onClose: () => void
  onEdit: () => void
  onDeleted: (meetingId: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
      {children}
    </p>
  )
}

const STATUS_CONFIG = {
  scheduled: { label: 'Agendada', className: 'bg-emerald-50 text-emerald-700' },
  completed: { label: 'Concluída', className: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelada', className: 'bg-red-50 text-red-600' },
} satisfies Record<MeetingWithLead['status'], { label: string; className: string }>

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MeetingDetailPanel({
  meeting,
  open,
  onClose,
  onEdit,
  onDeleted,
}: MeetingDetailPanelProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleDelete = async () => {
    if (!meeting) return
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json() as { error?: string }
        toast.error(json.error ?? 'Erro ao excluir reunião')
        return
      }
      toast.success('Reunião excluída')
      setDeleteDialogOpen(false)
      onDeleted(meeting.id)
      onClose()
    } catch {
      toast.error('Erro inesperado. Tente novamente.')
    } finally {
      setDeleteLoading(false)
    }
  }

  if (!meeting) return null

  const datetimeFormatted = format(
    new Date(meeting.datetime),
    "EEEE, d 'de' MMMM 'de' yyyy 'às' HH:mm",
    { locale: ptBR }
  ).replace(/^\w/, c => c.toUpperCase())

  const statusConfig = STATUS_CONFIG[meeting.status]
  const initials = getInitials(meeting.consultant_name)

  return (
    <>
      <Sheet open={open} onOpenChange={o => { if (!o) onClose() }}>
        <SheetContent
          side="right"
          showCloseButton={false}
          style={{ width: 480, maxWidth: 480 }}
          className="p-0 overflow-y-auto flex flex-col gap-0"
        >
          {/* Header */}
          <div className="px-6 pt-6 pb-5 flex-shrink-0" style={{ backgroundColor: '#0A2EAD' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-white leading-tight truncate">
                  {meeting.lead_name}
                </h2>
                <p className="text-white/60 text-xs mt-0.5">{meeting.lead_phone}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors p-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 flex-shrink-0 mt-0.5 cursor-pointer"
                aria-label="Fechar painel"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-0 flex-1">

            {/* Seção 1 — Data e Hora */}
            <div className="px-6 py-5">
              <SectionTitle>Data e Hora</SectionTitle>
              <div className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-3">
                <CalendarDays size={16} className="text-alliance-blue mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-700 leading-relaxed capitalize">
                  {datetimeFormatted}
                </span>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Seção 2 — Consultor */}
            <div className="px-6 py-5">
              <SectionTitle>Consultor</SectionTitle>
              <div className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: meeting.consultant_color }}
                >
                  {initials || <User size={14} />}
                </div>
                <span className="text-sm font-medium text-gray-700">{meeting.consultant_name}</span>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Seção 3 — Observações */}
            <div className="px-6 py-5">
              <SectionTitle>Observações</SectionTitle>
              {meeting.notes ? (
                <div className="bg-gray-50 rounded-xl px-3 py-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {meeting.notes}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Nenhuma observação.</p>
              )}
            </div>

            <div className="border-t border-gray-100" />

            {/* Seção 4 — Status */}
            <div className="px-6 py-5">
              <SectionTitle>Status</SectionTitle>
              <span className={cn(
                'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold',
                statusConfig.className,
              )}>
                {statusConfig.label}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => { setDeleteDialogOpen(true) }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors cursor-pointer"
            >
              <Trash2 size={14} />
              Excluir
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <Pencil size={14} />
              Editar
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-alliance-dark">Excluir Reunião</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 mt-1">
            Tem certeza que deseja excluir a reunião com{' '}
            <strong>{meeting.lead_name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleteLoading}
              className="px-4 py-2 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {deleteLoading && <Loader2 size={13} className="animate-spin" />}
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
