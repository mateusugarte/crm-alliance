'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { staggerContainer } from '@/lib/animations'
import { ImovelCard } from './imovel-card'
import { ImovelFormPanel } from './imovel-form-panel'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Imovel } from '@/lib/supabase/types'

interface ImovelGridProps {
  imoveis: Imovel[]
  isAdm?: boolean
}

export function ImovelGrid({ imoveis: initialImoveis, isAdm = false }: ImovelGridProps) {
  const [imoveis, setImoveis] = useState<Imovel[]>(initialImoveis)
  const [formOpen, setFormOpen] = useState(false)
  const [editingImovel, setEditingImovel] = useState<Imovel | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const deleteTarget = imoveis.find((i) => i.id === deleteConfirmId)

  // ── Toggle disponibilidade ──
  const handleToggle = async (id: string) => {
    const imovel = imoveis.find((i) => i.id === id)
    if (!imovel) return

    const newState = !imovel.disponivel
    setImoveis((prev) => prev.map((i) => (i.id === id ? { ...i, disponivel: newState } : i)))

    try {
      const res = await fetch(`/api/imoveis/${id}/toggle`, { method: 'POST' })
      if (!res.ok) throw new Error()
      toast.success(newState ? 'Imóvel marcado como disponível' : 'Imóvel marcado como indisponível')
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

  // ── Excluir (com confirmação) ──
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return

    const snapshot = imoveis
    setImoveis((prev) => prev.filter((i) => i.id !== deleteConfirmId))
    setDeleteConfirmId(null)

    try {
      const res = await fetch(`/api/imoveis/${deleteConfirmId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Imóvel excluído com sucesso.')
    } catch {
      setImoveis(snapshot)
      toast.error('Erro ao excluir imóvel.')
    }
  }

  // ── Salvo (criar ou editar) ──
  const handleSaved = (saved: Imovel) => {
    setImoveis((prev) => {
      const exists = prev.some((i) => i.id === saved.id)
      if (exists) {
        return prev.map((i) => (i.id === saved.id ? saved : i))
      }
      return [...prev, saved]
    })
    setFormOpen(false)
    setEditingImovel(null)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      {isAdm && (
        <div className="flex justify-end mb-1">
          <button
            onClick={() => {
              setEditingImovel(null)
              setFormOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-alliance-dark text-white text-sm font-semibold rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-dark"
          >
            <Plus size={15} />
            Novo Imóvel
          </button>
        </div>
      )}

      {/* Grid */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      >
        {imoveis.map((imovel) => (
          <ImovelCard
            key={imovel.id}
            imovel={imovel}
            isAdm={isAdm}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onDelete={(id) => setDeleteConfirmId(id)}
          />
        ))}
      </motion.div>

      {/* Form panel */}
      <ImovelFormPanel
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingImovel(null)
        }}
        imovel={editingImovel ?? undefined}
        isAdm={isAdm}
        onSaved={handleSaved}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={deleteConfirmId !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteConfirmId(null)
        }}
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
