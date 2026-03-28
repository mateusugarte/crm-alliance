'use client'

import { Bot, PauseCircle, Search } from 'lucide-react'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Skeleton } from '@/components/ui/skeleton'
import type { LeadWithLastInteraction } from './types'

interface LeadsSidebarProps {
  leads: LeadWithLastInteraction[]
  activeLeadId: string | null
  onSelect: (id: string) => void
  hasNewMessage?: boolean
}

export function LeadsSidebarSkeleton() {
  return (
    <div className="w-72 min-w-72 bg-alliance-dark flex flex-col overflow-hidden">
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <Skeleton className="h-3 w-20 rounded mb-1 opacity-30" />
        <Skeleton className="h-5 w-28 rounded opacity-40" />
      </div>
      <div className="px-3 pb-3 flex-shrink-0">
        <Skeleton className="h-9 w-full rounded-xl opacity-20" />
      </div>
      <div className="mx-4 border-t border-white/10 mb-1 flex-shrink-0" />
      <div className="flex-1 px-3 py-2 flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-1 py-2">
            <Skeleton className="w-9 h-9 rounded-full flex-shrink-0 opacity-20" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Skeleton className="h-3 w-24 rounded opacity-25" />
              <Skeleton className="h-2.5 w-36 rounded opacity-15" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LeadsSidebar({ leads, activeLeadId, onSelect, hasNewMessage }: LeadsSidebarProps) {
  const [search, setSearch] = useState('')

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search)
  )

  return (
    <div className="w-72 min-w-72 bg-alliance-dark flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">
          Interacoes
        </p>
        <div className="flex items-center gap-2">
          <span className="font-bold text-white text-lg tracking-tight">Conversas</span>
          {hasNewMessage && (
            <span
              className="w-2.5 h-2.5 rounded-full bg-alliance-blue animate-pulse flex-shrink-0"
              title="Nova mensagem recebida"
            />
          )}
        </div>
      </div>

      {/* Search */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-2">
          <Search size={14} className="text-white/40 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar lead..."
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none focus-visible:outline-none cursor-text"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-white/40 hover:text-white/70 transition-colors text-sm leading-none cursor-pointer"
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </div>
        {search && (
          <p className="text-white/30 text-xs mt-1.5 px-1">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/10 mb-1 flex-shrink-0" />

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-12 px-4">
            {search ? 'Nenhum resultado para a busca' : 'Nenhum lead ainda'}
          </div>
        ) : (
          filtered.map(lead => {
            const isActive = lead.id === activeLeadId
            return (
              <button
                key={lead.id}
                onClick={() => onSelect(lead.id)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all duration-150 border-l-2 cursor-pointer focus-visible:outline-none focus-visible:bg-white/10 ${
                  isActive
                    ? 'bg-white/[0.12] border-alliance-blue'
                    // Corrigido: bg-white/[0.08] em vez de bg-white/8 (não gerado pelo Tailwind v4)
                    : 'hover:bg-white/[0.08] border-transparent'
                }`}
              >
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold select-none ${
                  isActive ? 'bg-alliance-blue text-white' : 'bg-white/15 text-white'
                }`}>
                  {lead.name.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <span className="font-semibold text-white text-sm truncate">{lead.name}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {lead.automation_paused && <PauseCircle size={11} className="text-amber-400" />}
                      {!lead.assigned_to && !lead.automation_paused && <Bot size={11} className="text-white/40" />}
                    </div>
                  </div>
                  <p className="text-white/50 text-xs truncate">{lead.lastMessage}</p>
                  <p className="text-white/30 text-xs mt-0.5">
                    {formatDistanceToNow(new Date(lead.lastMessageAt), { locale: ptBR, addSuffix: true })}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
