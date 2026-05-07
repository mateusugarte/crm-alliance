'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Plus, Building2, Crown } from 'lucide-react'
import { staggerContainer } from '@/lib/animations'
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

interface ImovelGridProps {
  imoveis: Imovel[]
  vendas: Venda[]
  isAdm?: boolean
}

// Colunas do kanban: Blocos 1–4 por numero_unidade + Coberturas
const COLUNAS = [
  { label: 'Bloco 1', isCobertura: false, filter: (i: Imovel) => !i.cobertura && i.numero_unidade === 1 },
  { label: 'Bloco 2', isCobertura: false, filter: (i: Imovel) => !i.cobertura && i.numero_unidade === 2 },
  { label: 'Bloco 3', isCobertura: false, filter: (i: Imovel) => !i.cobertura && i.numero_unidade === 3 },
  { label: 'Bloco 4', isCobertura: false, filter: (i: Imovel) => !i.cobertura && i.numero_unidade === 4 },
  { label: 'Coberturas', isCobertura: true, filter: (i: Imovel) => i.cobertura },
]

export function ImovelGrid({ imoveis: initialImoveis, vendas: initialVendas, isAdm = false }: ImovelGridProps) {
  const [imoveis, setImoveis] = useState<Imovel[]>(initialImoveis)
  const [vendas, setVendas] = useState<Venda[]>(initialVendas)
  const [formOpen, setFormOpen] = useState(false)
  const [editingImovel, setEditingImovel] = useState<Imovel | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [vendaImovel, setVendaImovel] = useState<Imovel | null>(null)

  const deleteTarget = imoveis.find((i) => i.id === deleteConfirmId)

  // Imóveis ativos (não vendidos) para o kanban
  const activeImoveis = imoveis.filter(i => !i.vendido)
  // Imóveis vendidos para a seção inferior
  const vendidosImoveis = imoveis.filter(i => i.vendido)

  // ── Toggle disponibilidade ──
  const handleToggle = async (id: string) => {
    const imovel = imoveis.find((i) => i.id === id)
    if (!imovel) return
    const newState = !imovel.disponivel
    setImoveis((prev) => prev.map((i) => (i.id === id ? { ...i, disponivel: newState } : i)))
    try {
      const res = await fetch(`/api/imoveis/${id}/toggle`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success(newState ? 'Marcado como disponível' : 'Marcado como reservado')
    } catch {
      setImoveis((prev) => prev.map((i) => (i.id === id ? { ...i, disponivel: imovel.disponivel } : i)))
      toast.error('Erro ao atualizar disponibilidade.')
    }
  }

  // ── Editar ──
  const handleEdit = (imovel: Imovel) => {
    setEditingImovel(imovel)
    setFormOpen(true)
  }

  // ── Excluir ──
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return
    const snapshot = imoveis
    setImoveis((prev) => prev.filter((i) => i.id !== deleteConfirmId))
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

  // ── Salvo (criar ou editar) ──
  const handleSaved = (saved: Imovel) => {
    setImoveis((prev) => {
      const exists = prev.some((i) => i.id === saved.id)
      return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
    })
    setFormOpen(false)
    setEditingImovel(null)
  }

  // ── Venda registrada ──
  const handleVendaSaved = (venda: Venda, imovelId: string) => {
    setImoveis((prev) =>
      prev.map((i) => i.id === imovelId ? { ...i, vendido: true, disponivel: false } : i)
    )
    setVendas((prev) => [venda, ...prev])
    setVendaImovel(null)
    toast.success('Venda registrada com sucesso!')
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      {isAdm && (
        <div className="flex justify-end mb-5">
          <button
            onClick={() => { setEditingImovel(null); setFormOpen(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-dark"
          >
            <Plus size={15} />
            Novo Imóvel
          </button>
        </div>
      )}

      {/* Kanban: colunas por bloco */}
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
        {COLUNAS.map((col) => {
          const colImoveis = activeImoveis.filter(col.filter)
          return (
            <div key={col.label} className="flex-shrink-0 w-64 flex flex-col gap-3">
              {/* Cabeçalho da coluna */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-alliance-dark/5 border border-alliance-dark/10 sticky top-0">
                {col.isCobertura
                  ? <Crown size={14} className="text-amber-600" />
                  : <Building2 size={14} className="text-alliance-dark" />
                }
                <span className="text-xs font-bold text-alliance-dark">{col.label}</span>
                <span className="ml-auto text-xs font-semibold text-gray-400 bg-white px-1.5 py-0.5 rounded-md border border-gray-100">
                  {colImoveis.length}
                </span>
              </div>

              {/* Cards */}
              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="flex flex-col gap-3"
              >
                {colImoveis.length === 0 ? (
                  <div className="text-center py-10 text-xs text-gray-300 border-2 border-dashed border-gray-100 rounded-2xl">
                    Sem unidades
                  </div>
                ) : (
                  colImoveis.map((imovel) => (
                    <ImovelCard
                      key={imovel.id}
                      imovel={imovel}
                      isAdm={isAdm}
                      onToggle={handleToggle}
                      onEdit={handleEdit}
                      onDelete={(id) => setDeleteConfirmId(id)}
                      onRegistrarVenda={isAdm ? setVendaImovel : undefined}
                    />
                  ))
                )}
              </motion.div>
            </div>
          )
        })}
      </div>

      {/* Seção de vendidos */}
      <ImovelVendidosSection
        imoveis={vendidosImoveis}
        vendas={vendas}
        isAdm={isAdm}
      />

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
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(o) => { if (!o) setDeleteConfirmId(null) }}
      >
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
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-4 py-2 text-sm font-semibold text-gray-600 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer focus-visible:outline-none"
            >
              Cancelar
            </button>
            <button
              onClick={handleDeleteConfirm}
              className="px-4 py-2 text-sm font-semibold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors cursor-pointer focus-visible:outline-none"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
