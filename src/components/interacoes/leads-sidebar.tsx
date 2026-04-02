'use client'

import { Bot, PauseCircle, Search, User } from 'lucide-react'
import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { LeadWithLastInteraction, LeadContact } from './types'

interface LeadsSidebarProps {
  conversations: LeadWithLastInteraction[]
  contacts: LeadContact[]
  activeLeadId: string | null
  onSelect: (id: string) => void
  unreadCounts: Record<string, number>
}

export function LeadsSidebar({ conversations, contacts, activeLeadId, onSelect, unreadCounts }: LeadsSidebarProps) {
  const [search, setSearch] = useState('')

  const filterConversations = conversations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search)
  )

  const filterContacts = contacts.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search)
  )

  return (
    <div className="w-72 min-w-72 bg-alliance-dark flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex-shrink-0">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">
          Interações
        </p>
        <span className="font-bold text-white text-lg tracking-tight">Conversas</span>
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
            className="flex-1 bg-transparent text-white text-sm placeholder-white/30 outline-none"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-white/10 mb-1 flex-shrink-0" />

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {/* Seção Conversas */}
        {filterConversations.length > 0 && (
          <>
            <p className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Conversas
            </p>
            {filterConversations.map(lead => {
              const isActive = lead.id === activeLeadId
              return (
                <button
                  key={lead.id}
                  onClick={() => onSelect(lead.id)}
                  className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-all duration-150 border-l-2 ${
                    isActive
                      ? 'bg-white/12 border-alliance-blue'
                      : 'hover:bg-white/8 border-transparent'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    isActive ? 'bg-alliance-blue text-white' : 'bg-white/15 text-white'
                  }`}>
                    {lead.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-semibold text-white text-sm truncate">{lead.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {lead.automation_paused && <PauseCircle size={11} className="text-amber-400" />}
                        {!lead.assigned_to && !lead.automation_paused && <Bot size={11} className="text-white/40" />}
                        {(unreadCounts[lead.id] ?? 0) > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-alliance-blue px-1 text-[10px] font-bold text-white">
                            {unreadCounts[lead.id]}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-white/50 text-xs truncate">{lead.lastMessage}</p>
                    <p className="text-white/30 text-xs mt-0.5">
                      {formatDistanceToNow(new Date(lead.lastMessageAt!), { locale: ptBR, addSuffix: true })}
                    </p>
                  </div>
                </button>
              )
            })}
          </>
        )}

        {/* Seção Contatos */}
        {filterContacts.length > 0 && (
          <>
            <div className="mx-4 mt-3 mb-1 border-t border-white/10" />
            <p className="px-4 pt-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Contatos
            </p>
            {filterContacts.map(lead => {
              const isActive = lead.id === activeLeadId
              return (
                <button
                  key={lead.id}
                  onClick={() => onSelect(lead.id)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-all duration-150 border-l-2 ${
                    isActive
                      ? 'bg-white/12 border-alliance-blue'
                      : 'hover:bg-white/8 border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                    isActive ? 'bg-alliance-blue text-white' : 'bg-white/10 text-white/60'
                  }`}>
                    <User size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-medium text-white/70 text-sm truncate">{lead.name}</span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {lead.automation_paused && <PauseCircle size={11} className="text-amber-400" />}
                        {!lead.assigned_to && !lead.automation_paused && <Bot size={11} className="text-white/30" />}
                      </div>
                    </div>
                    <p className="text-white/30 text-xs">{lead.phone}</p>
                  </div>
                </button>
              )
            })}
          </>
        )}

        {/* Estado vazio */}
        {filterConversations.length === 0 && filterContacts.length === 0 && (
          <div className="text-center text-white/30 text-sm py-12 px-4">
            {search ? 'Nenhum resultado' : 'Nenhum lead ainda'}
          </div>
        )}
      </div>
    </div>
  )
}
