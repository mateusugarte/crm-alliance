'use client'

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { toast } from 'sonner'
import { Plus, Building2, Crown, Clock, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { ImovelCard } from './imovel-card'
import { ImovelFormPanel } from './imovel-form-panel'
import { ImovelVendaForm } from './imovel-venda-form'
import { ImovelVendidosSection } from './imovel-vendidos-section'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Imovel, Venda } from '@/lib/supabase/types'

// ─── Colunas fixas — usuário organiza livremente dentro delas ──────────────────

const COLS = [
  { id: 'bloco1',    label: 'Bloco 1',    icon: Building2, cobertura: false },
  { id: 'bloco2',    label: 'Bloco 2',    icon: Building2, cobertura: false },
  { id: 'bloco3',    label: 'Bloco 3',    icon: Building2, cobertura: false },
  { id: 'bloco4',    label: 'Bloco 4',    icon: Building2, cobertura: false },
  { id: 'coberturas', label: 'Coberturas', icon: Crown,     cobertura: true  },
]

const STORAGE_KEY = 'la-reserva-imoveis-layout'

// ─── Helpers de layout ─────────────────────────────────────────────────────────

function getDefaultColId(imovel: Imovel): string {
  if (imovel.cobertura) return 'coberturas'
  const n = imovel.numero_unidade
  if (n === 1) return 'bloco1'
  if (n === 2) return 'bloco2'
  if (n === 3) return 'bloco3'
  return 'bloco4'
}

function buildDefault(imoveis: Imovel[]): Record<string, string[]> {
  const cols: Record<string, string[]> = { bloco1: [], bloco2: [], bloco3: [], bloco4: [], coberturas: [] }
  for (const im of imoveis) cols[getDefaultColId(im)].push(im.id)
  return cols
}

function loadLayout(imoveis: Imovel[]): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildDefault(imoveis)
    const stored = JSON.parse(raw) as Record<string, string[]>
    const allIds = new Set(imoveis.map(i => i.id))
    const storedIds = new Set(Object.values(stored).flat())
    // Adiciona novos imóveis na coluna padrão
    for (const im of imoveis) {
      if (!storedIds.has(im.id)) {
        const col = getDefaultColId(im)
        if (!stored[col]) stored[col] = []
        stored[col].push(im.id)
      }
    }
    // Remove IDs que não existem mais
    const result: Record<string, string[]> = { bloco1: [], bloco2: [], bloco3: [], bloco4: [], coberturas: [] }
    for (const colId of Object.keys(stored)) {
      result[colId] = (stored[colId] ?? []).filter(id => allIds.has(id))
    }
    return result
  } catch {
    return buildDefault(imoveis)
  }
}

function saveLayout(cols: Record<string, string[]>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cols)) } catch { /* ignore */ }
}

function findColOf(id: string, cols: Record<string, string[]>): string | undefined {
  return Object.keys(cols).find(colId => cols[colId].includes(id))
}

// ─── SortableCard — wrapper com useSortable ───────────────────────────────────

function SortableCard(props: React.ComponentProps<typeof ImovelCard>) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.imovel.id,
  })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
    >
      <ImovelCard {...props} dragHandleProps={listeners} isDragging={isDragging} />
    </div>
  )
}

// ─── DroppableColumn ──────────────────────────────────────────────────────────

function DroppableColumn({
  col,
  ids,
  imoveis,
  isAdm,
  isOver: externalIsOver,
  onToggle,
  onEdit,
  onDelete,
  onRegistrarVenda,
}: {
  col: typeof COLS[number]
  ids: string[]
  imoveis: Imovel[]
  isAdm: boolean
  isOver?: boolean
  onToggle: (id: string) => void
  onEdit: (i: Imovel) => void
  onDelete: (id: string) => void
  onRegistrarVenda?: (i: Imovel) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id })
  const Icon = col.icon
  const highlighted = isOver || externalIsOver

  return (
    <div className="flex-shrink-0 w-56 flex flex-col">
      {/* Column header */}
      <div className={`
        flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 transition-colors
        ${col.cobertura
          ? 'bg-amber-50 border border-amber-200/60'
          : 'bg-alliance-dark/[0.04] border border-alliance-dark/[0.08]'
        }
      `}>
        <Icon size={13} className={col.cobertura ? 'text-amber-600' : 'text-alliance-dark/60'} />
        <span className={`text-xs font-bold flex-1 ${col.cobertura ? 'text-amber-700' : 'text-alliance-dark'}`}>
          {col.label}
        </span>
        <span className={`
          text-[10px] font-bold px-1.5 py-0.5 rounded-md
          ${col.cobertura ? 'bg-amber-100 text-amber-600' : 'bg-white text-gray-400 border border-gray-100'}
        `}>
          {ids.length}
        </span>
      </div>

      {/* Droppable area */}
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={`
            flex-1 flex flex-col gap-2.5 min-h-32 rounded-xl p-2 transition-all duration-150
            ${highlighted
              ? 'bg-alliance-blue/5 ring-2 ring-alliance-blue/20 ring-dashed'
              : 'bg-transparent'
            }
          `}
        >
          {ids.length === 0 ? (
            <div className={`
              flex-1 min-h-24 flex items-center justify-center rounded-xl border-2 border-dashed transition-colors
              ${highlighted ? 'border-alliance-blue/30 bg-alliance-blue/3' : 'border-gray-100'}
            `}>
              <span className="text-[10px] text-gray-300">Arraste aqui</span>
            </div>
          ) : (
            ids.map(id => {
              const imovel = imoveis.find(i => i.id === id)
              if (!imovel) return null
              return (
                <SortableCard
                  key={id}
                  imovel={imovel}
                  isAdm={isAdm}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onRegistrarVenda={isAdm ? onRegistrarVenda : undefined}
                />
              )
            })
          )}
        </div>
      </SortableContext>
    </div>
  )
}

// ─── ImovelGrid ───────────────────────────────────────────────────────────────

interface ImovelGridProps {
  imoveis: Imovel[]
  vendas: Venda[]
  isAdm?: boolean
}

export function ImovelGrid({ imoveis: initialImoveis, vendas: initialVendas, isAdm = false }: ImovelGridProps) {
  const [imoveis, setImoveis] = useState<Imovel[]>(initialImoveis)
  const [vendas, setVendas] = useState<Venda[]>(initialVendas)
  const [formOpen, setFormOpen] = useState(false)
  const [editingImovel, setEditingImovel] = useState<Imovel | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [vendaImovel, setVendaImovel] = useState<Imovel | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeImoveis = imoveis.filter(i => !i.vendido)
  const vendidosImoveis = imoveis.filter(i => i.vendido)

  const [columns, setColumns] = useState<Record<string, string[]>>(() =>
    loadLayout(activeImoveis)
  )

  const reservedCount = activeImoveis.filter(i => !i.disponivel).length
  const deleteTarget = imoveis.find(i => i.id === deleteConfirmId)
  const activeDragImovel = activeId ? imoveis.find(i => i.id === activeId) ?? null : null

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // ── Sync columns when imoveis change ──
  const syncColumns = useCallback((newImoveis: Imovel[]) => {
    setColumns(prev => {
      const active = newImoveis.filter(i => !i.vendido)
      return loadLayout(active)
    })
  }, [])

  // ── Drag handlers ──

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const sourceCol = findColOf(activeId, columns)
    const targetCol = findColOf(overId, columns) ?? (COLS.find(c => c.id === overId) ? overId : undefined)

    if (!sourceCol || !targetCol || sourceCol === targetCol) return

    setColumns(prev => {
      const sourceItems = [...prev[sourceCol]]
      const targetItems = [...prev[targetCol]]
      const activeIndex = sourceItems.indexOf(activeId)
      const overIndex = targetItems.indexOf(overId)

      sourceItems.splice(activeIndex, 1)
      const insertAt = overIndex >= 0 ? overIndex : targetItems.length
      targetItems.splice(insertAt, 0, activeId)

      return { ...prev, [sourceCol]: sourceItems, [targetCol]: targetItems }
    })
  }, [columns])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const sourceCol = findColOf(activeId, columns)
    const targetCol = findColOf(overId, columns) ?? (COLS.find(c => c.id === overId) ? overId : undefined)

    if (!sourceCol || !targetCol) return

    let newCols = columns

    if (sourceCol === targetCol && activeId !== overId) {
      const items = columns[sourceCol]
      const oldIdx = items.indexOf(activeId)
      const newIdx = items.indexOf(overId)
      newCols = { ...columns, [sourceCol]: arrayMove(items, oldIdx, newIdx) }
      setColumns(newCols)
    }

    saveLayout(newCols)
  }, [columns])

  const handleDragCancel = useCallback(() => setActiveId(null), [])

  // ── Toggle ──
  const handleToggle = async (id: string) => {
    const imovel = imoveis.find(i => i.id === id)
    if (!imovel) return
    const newState = !imovel.disponivel
    setImoveis(prev => prev.map(i => i.id === id ? { ...i, disponivel: newState } : i))
    try {
      const res = await fetch(`/api/imoveis/${id}/toggle`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success(newState ? 'Marcado como disponível' : 'Marcado como reservado')
    } catch {
      setImoveis(prev => prev.map(i => i.id === id ? { ...i, disponivel: imovel.disponivel } : i))
      toast.error('Erro ao atualizar disponibilidade.')
    }
  }

  // ── Edit / Delete / Saved ──
  const handleEdit = (imovel: Imovel) => { setEditingImovel(imovel); setFormOpen(true) }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    const snapshot = imoveis
    setImoveis(prev => prev.filter(i => i.id !== deleteConfirmId))
    setColumns(prev => {
      const updated = { ...prev }
      for (const col of Object.keys(updated)) updated[col] = updated[col].filter(id => id !== deleteConfirmId)
      saveLayout(updated)
      return updated
    })
    setDeleteConfirmId(null)
    try {
      const res = await fetch(`/api/imoveis/${deleteConfirmId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Imóvel excluído.')
    } catch {
      setImoveis(snapshot)
      toast.error('Erro ao excluir imóvel.')
    }
  }

  const handleSaved = (saved: Imovel) => {
    setImoveis(prev => {
      const exists = prev.some(i => i.id === saved.id)
      const next = exists ? prev.map(i => i.id === saved.id ? saved : i) : [...prev, saved]
      if (!exists) {
        // Novo imóvel: adiciona na coluna padrão
        setColumns(cols => {
          const col = getDefaultColId(saved)
          const updated = { ...cols, [col]: [...(cols[col] ?? []), saved.id] }
          saveLayout(updated)
          return updated
        })
      }
      return next
    })
    setFormOpen(false)
    setEditingImovel(null)
  }

  const handleVendaSaved = (venda: Venda, imovelId: string) => {
    setImoveis(prev => prev.map(i => i.id === imovelId ? { ...i, vendido: true, disponivel: false } : i))
    setVendas(prev => [venda, ...prev])
    setColumns(prev => {
      const updated = { ...prev }
      for (const col of Object.keys(updated)) updated[col] = updated[col].filter(id => id !== imovelId)
      saveLayout(updated)
      return updated
    })
    setVendaImovel(null)
    toast.success('Venda registrada com sucesso!')
  }

  const handleResetLayout = () => {
    const defaults = buildDefault(activeImoveis)
    setColumns(defaults)
    saveLayout(defaults)
    toast.success('Layout restaurado para o padrão.')
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Link
            href="/imoveis/reservados"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors focus-visible:outline-none"
          >
            <Clock size={13} />
            Reservados
            {reservedCount > 0 && (
              <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                {reservedCount}
              </span>
            )}
          </Link>
          <button
            onClick={handleResetLayout}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-600 transition-colors focus-visible:outline-none"
            title="Restaurar organização padrão"
          >
            <RotateCcw size={12} />
            Restaurar padrão
          </button>
        </div>
        {isAdm && (
          <button
            onClick={() => { setEditingImovel(null); setFormOpen(true) }}
            className="flex items-center gap-1.5 px-4 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer focus-visible:outline-none"
          >
            <Plus size={14} />
            Novo Imóvel
          </button>
        )}
      </div>

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex gap-4 overflow-x-auto pb-6 -mx-1 px-1">
          {COLS.map(col => (
            <DroppableColumn
              key={col.id}
              col={col}
              ids={columns[col.id] ?? []}
              imoveis={activeImoveis}
              isAdm={isAdm}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={id => setDeleteConfirmId(id)}
              onRegistrarVenda={setVendaImovel}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 160, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeDragImovel && (
            <div className="rotate-1 scale-105">
              <ImovelCard imovel={activeDragImovel} isAdm={false} isDragging />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Vendidos */}
      <ImovelVendidosSection imoveis={vendidosImoveis} vendas={vendas} isAdm={isAdm} />

      {/* Form de criação/edição */}
      <ImovelFormPanel
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingImovel(null) }}
        imovel={editingImovel ?? undefined}
        isAdm={isAdm}
        onSaved={handleSaved}
      />

      {/* Form de venda */}
      <ImovelVendaForm
        imovel={vendaImovel}
        imoveis={activeImoveis}
        onClose={() => setVendaImovel(null)}
        onSaved={handleVendaSaved}
      />

      {/* Dialog de exclusão */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={o => { if (!o) setDeleteConfirmId(null) }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Excluir imóvel</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `Tem certeza que deseja excluir "${deleteTarget.nome}"? Esta ação não pode ser desfeita.`
                : 'Tem certeza que deseja excluir este imóvel? Esta ação não pode ser desfeita.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer">
              Cancelar
            </button>
            <button onClick={handleDeleteConfirm} className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors cursor-pointer">
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
