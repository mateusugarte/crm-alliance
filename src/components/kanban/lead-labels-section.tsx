'use client'

import { useEffect, useState, useRef } from 'react'
import { Plus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { Label } from './types'

const LABEL_PALETTE = [
  '#6366F1', '#EC4899', '#F59E0B', '#10B981',
  '#3B82F6', '#EF4444', '#8B5CF6', '#14B8A6',
]

interface LabelsSectionProps {
  labels: Label[]
  leadId: string
  onLabelsChange: (labels: Label[]) => void
}

export function LabelsSection({ labels, leadId, onLabelsChange }: LabelsSectionProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [availableLabels, setAvailableLabels] = useState<Label[]>([])
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_PALETTE[0])
  const [creatingNew, setCreatingNew] = useState(false)
  const [loadingLabels, setLoadingLabels] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverOpen) return
    setLoadingLabels(true)
    fetch('/api/labels')
      .then(r => r.json() as Promise<{ data: Label[] }>)
      .then(json => setAvailableLabels(json.data ?? []))
      .catch(() => toast.error('Erro ao carregar etiquetas'))
      .finally(() => setLoadingLabels(false))
  }, [popoverOpen])

  useEffect(() => {
    if (!popoverOpen) return
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverOpen(false)
        setCreatingNew(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popoverOpen])

  const handleAddLabel = async (label: Label) => {
    if (labels.some(l => l.id === label.id)) return
    setActionLoading(label.id)
    try {
      const res = await fetch(`/api/leads/${leadId}/labels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_id: label.id }),
      })
      if (!res.ok) throw new Error()
      onLabelsChange([...labels, label])
      toast.success(`Etiqueta "${label.name}" adicionada`)
    } catch {
      toast.error('Erro ao adicionar etiqueta')
    } finally {
      setActionLoading(null)
      setPopoverOpen(false)
    }
  }

  const handleRemoveLabel = async (labelId: string) => {
    setActionLoading(labelId)
    try {
      const res = await fetch(`/api/leads/${leadId}/labels?label_id=${labelId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      onLabelsChange(labels.filter(l => l.id !== labelId))
      toast.success('Etiqueta removida')
    } catch {
      toast.error('Erro ao remover etiqueta')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return
    setActionLoading('new')
    try {
      const res = await fetch('/api/labels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newLabelName.trim(), color: newLabelColor }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data: Label }
      await handleAddLabel(json.data)
      setNewLabelName('')
      setCreatingNew(false)
    } catch {
      toast.error('Erro ao criar etiqueta')
    } finally {
      setActionLoading(null)
    }
  }

  const unattachedLabels = availableLabels.filter(al => !labels.some(l => l.id === al.id))

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {labels.map(label => (
        <span
          key={label.id}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full text-white"
          style={{ backgroundColor: label.color }}
        >
          {label.name}
          <button
            onClick={() => handleRemoveLabel(label.id)}
            disabled={actionLoading === label.id}
            className="hover:opacity-70 transition-opacity focus-visible:outline-none cursor-pointer"
            aria-label={`Remover etiqueta ${label.name}`}
          >
            {actionLoading === label.id
              ? <Loader2 size={10} className="animate-spin" />
              : <X size={10} />
            }
          </button>
        </span>
      ))}

      <div className="relative" ref={popoverRef}>
        <button
          onClick={() => setPopoverOpen(v => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-alliance-blue border border-alliance-blue/30 bg-alliance-blue/5 hover:bg-alliance-blue/10 px-2.5 py-1 rounded-full transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue"
        >
          <Plus size={11} />
          Adicionar
        </button>

        {popoverOpen && (
          <div className="absolute left-0 top-8 z-50 w-56 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden">
            {loadingLabels ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={16} className="animate-spin text-alliance-blue" />
              </div>
            ) : (
              <>
                {unattachedLabels.length > 0 && (
                  <div className="py-1.5 max-h-48 overflow-y-auto">
                    {unattachedLabels.map(label => (
                      <button
                        key={label.id}
                        onClick={() => handleAddLabel(label)}
                        disabled={actionLoading === label.id}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left cursor-pointer"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.color }}
                        />
                        <span className="text-xs text-gray-700">{label.name}</span>
                        {actionLoading === label.id && (
                          <Loader2 size={11} className="animate-spin ml-auto text-alliance-blue" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {unattachedLabels.length > 0 && (
                  <div className="border-t border-gray-100" />
                )}

                {!creatingNew ? (
                  <button
                    onClick={() => setCreatingNew(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-alliance-blue hover:bg-alliance-blue/5 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                    Nova etiqueta
                  </button>
                ) : (
                  <div className="p-3 flex flex-col gap-2">
                    <input
                      autoFocus
                      value={newLabelName}
                      onChange={e => setNewLabelName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateLabel() }}
                      placeholder="Nome da etiqueta"
                      className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-alliance-blue"
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {LABEL_PALETTE.map(color => (
                        <button
                          key={color}
                          onClick={() => setNewLabelColor(color)}
                          className={cn(
                            'w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110',
                            newLabelColor === color && 'ring-2 ring-offset-1 ring-gray-400'
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={handleCreateLabel}
                        disabled={actionLoading === 'new' || !newLabelName.trim()}
                        className="flex-1 text-xs bg-alliance-dark text-white py-1.5 rounded-lg hover:bg-alliance-dark/90 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading === 'new' ? <Loader2 size={11} className="animate-spin mx-auto" /> : 'Criar'}
                      </button>
                      <button
                        onClick={() => { setCreatingNew(false); setNewLabelName('') }}
                        className="flex-1 text-xs bg-gray-100 text-gray-600 py-1.5 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
