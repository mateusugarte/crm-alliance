'use client'

import {
  Bot, PauseCircle, Search, User, MessagesSquare,
  Plus, PenLine, Users, ArrowLeft,
} from 'lucide-react'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { LeadWithLastInteraction, LeadContact, Label } from './types'

interface LeadsSidebarProps {
  conversations: LeadWithLastInteraction[]
  contacts: LeadContact[]
  activeLeadId: string | null
  onSelect: (id: string) => void
  unreadCounts: Record<string, number>
  onCreateLead?: () => void
  allLabels: Label[]
}

function getAvatarColor(name: string): string {
  const colors = [
    'linear-gradient(135deg, #1E90FF 0%, #0A2EAD 100%)',
    'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
    'linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export function LeadsSidebar({
  conversations, contacts, activeLeadId, onSelect,
  unreadCounts, onCreateLead, allLabels,
}: LeadsSidebarProps) {
  const [view, setView] = useState<'conversations' | 'contacts'>('conversations')
  const [search, setSearch] = useState('')
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null)

  const filteredConversations = conversations.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
  )

  const filteredContacts = contacts.filter(l => {
    const matchesSearch = l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search)
    const matchesLabel = !selectedLabelId || (l.labels ?? []).some(lb => lb.id === selectedLabelId)
    return matchesSearch && matchesLabel
  })

  return (
    <div className="w-72 min-w-72 bg-alliance-dark flex flex-col overflow-hidden border-r border-white/5">

      {/* ── HEADER ── */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <MessagesSquare size={13} className="text-white/30" />
          <p className="text-white/30 text-[9px] font-bold uppercase tracking-[0.2em]">Interações</p>
        </div>
        <div className="flex items-center justify-between">
          {view === 'conversations' ? (
            <>
              <span className="font-bold text-white text-lg tracking-tight">Conversas</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setView('contacts'); setSearch('') }}
                  title="Ver contatos"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 text-white/50 hover:text-white text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <Users size={12} />
                  Contatos
                </button>
                {onCreateLead && (
                  <button
                    onClick={onCreateLead}
                    title="Novo lead manual"
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/8 hover:bg-white/15 border border-white/10 text-white/50 hover:text-white transition-colors cursor-pointer focus-visible:outline-none"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setView('conversations'); setSearch(''); setSelectedLabelId(null) }}
                  className="text-white/40 hover:text-white transition-colors cursor-pointer"
                  title="Voltar para conversas"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="font-bold text-white text-lg tracking-tight">Contatos</span>
              </div>
              <span className="text-white/30 text-xs">{filteredContacts.length}</span>
            </>
          )}
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-white/8 border border-white/8">
          <Search size={13} className="text-white/30 flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={view === 'conversations' ? 'Buscar conversa...' : 'Buscar contato...'}
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/25 outline-none"
          />
        </div>
      </div>

      {/* ── LABEL FILTER (contacts only) ── */}
      <AnimatePresence>
        {view === 'contacts' && allLabels.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="px-3 pb-3 flex-shrink-0"
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedLabelId(null)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                  !selectedLabelId
                    ? 'bg-white/20 text-white'
                    : 'bg-white/6 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}
              >
                Todas
              </button>
              {allLabels.map(label => (
                <button
                  key={label.id}
                  onClick={() => setSelectedLabelId(selectedLabelId === label.id ? null : label.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors cursor-pointer ${
                    selectedLabelId === label.id
                      ? 'bg-white/20 text-white'
                      : 'bg-white/6 text-white/40 hover:bg-white/10 hover:text-white/60'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-4 mb-1 h-px bg-white/8 flex-shrink-0" />

      {/* ── LIST ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">

          {/* CONVERSATIONS VIEW */}
          {view === 'conversations' && (
            <motion.div
              key="conversations"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
            >
              {filteredConversations.length > 0 ? (
                <>
                  <p className="px-4 pt-3 pb-2 text-[9px] font-bold uppercase tracking-[0.2em] text-white/25">
                    Conversas · {filteredConversations.length}
                  </p>
                  {filteredConversations.map((lead, i) => {
                    const isActive = lead.id === activeLeadId
                    const unread = unreadCounts[lead.id] ?? 0
                    const isManual = !lead.wa_contact_id
                    return (
                      <motion.button
                        key={lead.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                        onClick={() => onSelect(lead.id)}
                        className="w-full text-left px-3 py-2.5 flex items-start gap-3 transition-colors duration-150 cursor-pointer"
                        style={{
                          background: isActive ? 'rgba(30,144,255,0.15)' : undefined,
                          borderLeft: `2px solid ${isActive ? '#1E90FF' : 'transparent'}`,
                        }}
                        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-white relative"
                          style={{ background: getAvatarColor(lead.name) }}
                        >
                          {getInitials(lead.name)}
                          {unread > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold text-white bg-alliance-blue">
                              {unread}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-sm truncate ${isActive ? 'font-bold text-white' : 'font-semibold text-white/80'}`}>
                                {lead.name}
                              </span>
                              {isManual && (
                                <PenLine size={10} className="text-amber-400/80 flex-shrink-0" aria-label="Lead manual" />
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {lead.automation_paused
                                ? <PauseCircle size={11} className="text-amber-400/70" />
                                : <Bot size={11} className="text-white/25" />
                              }
                            </div>
                          </div>
                          <p className="text-white/35 text-xs truncate leading-tight">{lead.lastMessage}</p>
                          {lead.lastMessageAt && (
                            <p className="text-white/20 text-[10px] mt-0.5">
                              {formatDistanceToNow(new Date(lead.lastMessageAt), { locale: ptBR, addSuffix: true })}
                            </p>
                          )}
                        </div>
                      </motion.button>
                    )
                  })}
                </>
              ) : (
                <div className="text-center py-16 px-4">
                  <p className="text-white/20 text-sm">{search ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}</p>
                </div>
              )}
            </motion.div>
          )}

          {/* CONTACTS VIEW */}
          {view === 'contacts' && (
            <motion.div
              key="contacts"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
            >
              {filteredContacts.length > 0 ? (
                filteredContacts.map((lead, i) => {
                  const isActive = lead.id === activeLeadId
                  const isManual = !lead.wa_contact_id
                  return (
                    <motion.button
                      key={lead.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.015, duration: 0.2 }}
                      onClick={() => { onSelect(lead.id); setView('conversations') }}
                      className="w-full text-left px-3 py-2.5 flex items-center gap-3 transition-colors duration-150 cursor-pointer"
                      style={{
                        background: isActive ? 'rgba(30,144,255,0.15)' : undefined,
                        borderLeft: `2px solid ${isActive ? '#1E90FF' : 'transparent'}`,
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white/8 border border-white/10">
                        <User size={14} className="text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-medium text-white/70 text-sm truncate">{lead.name}</span>
                          {isManual && (
                            <PenLine size={10} className="text-amber-400/60 flex-shrink-0" aria-label="Lead manual" />
                          )}
                          {lead.automation_paused
                            ? <PauseCircle size={11} className="text-amber-400/50 flex-shrink-0 ml-auto" />
                            : <Bot size={11} className="text-white/20 flex-shrink-0 ml-auto" />
                          }
                        </div>
                        <p className="text-white/25 text-xs truncate">{lead.phone}</p>
                        {(lead.labels ?? []).length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {(lead.labels ?? []).map(label => (
                              <span
                                key={label.id}
                                className="flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${label.color}22`,
                                  color: label.color,
                                  border: `1px solid ${label.color}44`,
                                }}
                              >
                                {label.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.button>
                  )
                })
              ) : (
                <div className="text-center py-16 px-4">
                  <p className="text-white/20 text-sm">
                    {search || selectedLabelId ? 'Nenhum resultado' : 'Nenhum contato sem conversa'}
                  </p>
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
