'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function KanbanPageHeader() {
  const [creatingLead, setCreatingLead] = useState(false)

  const handleNewLead = async () => {
    if (creatingLead) return
    setCreatingLead(true)
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Novo Lead',
          phone: '',
          stage: 'lead_frio',
        }),
      })
      if (!res.ok) {
        const err = await res.json() as { error?: string }
        toast.error(err.error ?? 'Erro ao criar lead')
        return
      }
      toast.success('Lead criado. Edite as informacoes no painel lateral.')
    } catch {
      toast.error('Erro ao criar lead. Verifique a conexao.')
    } finally {
      setCreatingLead(false)
    }
  }

  const handleEtiquetas = () => {
    toast.info('Gerenciamento de etiquetas em breve.')
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleEtiquetas}
        className="px-4 py-2 text-body font-medium border border-gray-200 rounded-xl hover:border-alliance-dark hover:text-alliance-dark transition-colors bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue"
      >
        Etiquetas
      </button>
      <button
        onClick={handleNewLead}
        disabled={creatingLead}
        className="px-4 py-2 text-body font-semibold bg-alliance-dark text-white rounded-xl hover:bg-alliance-dark/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-alliance-blue focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {creatingLead ? 'Criando...' : '+ Novo Lead'}
      </button>
    </div>
  )
}
