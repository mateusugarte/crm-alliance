'use client'

import { useState } from 'react'
import { Loader2, Plus, Tag } from 'lucide-react'
import { toast } from 'sonner'

export function KanbanPageHeader() {
  const [creatingLead, setCreatingLead] = useState(false)

  const handleNewLead = async () => {
    // TODO: abrir modal de criação de lead
    // Por ora, toast informativo até o modal ser implementado
    toast.info('Em breve: criação de leads manuais')
  }

  const handleEtiquetas = () => {
    toast.info('Em breve: gerenciamento de etiquetas')
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleEtiquetas}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium border border-gray-200 rounded-xl hover:border-alliance-dark hover:text-alliance-dark transition-colors bg-white cursor-pointer"
      >
        <Tag size={14} />
        Etiquetas
      </button>
      <button
        onClick={handleNewLead}
        disabled={creatingLead}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-alliance-dark text-white rounded-xl hover:bg-alliance-dark/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
      >
        {creatingLead ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <Plus size={14} />
        )}
        Novo Lead
      </button>
    </div>
  )
}
