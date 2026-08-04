'use client'

import {
  Bot, PauseCircle, Search, User, MessagesSquare,
  Plus, PenLine, Users, ArrowLeft, PhoneCall,
} from '@/lib/icons'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { LeadWithLastInteraction, LeadContact, Label } from './types'
import { cn } from '@/lib/utils'

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
    'var(--brand)',
    'var(--stage-follow-up)',
    'var(--stage-cliente)',
    'var(--stage-morno)',
    'var(--stage-quente)',
    'var(--stage-sem-interesse)',
    'var(--stage-visita)',
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
    <div className="w-72 min-w-72 bg-surface flex flex-col overflow-hidden border-r border-line">

      {/* ── HEADER ── */}
      <div className="px-4 pt-5 pb-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <MessagesSquare size={13} className="text-ink-subtle" />
          <p className="text-ink-subtle text-2xs font-bold  ">Interações</p>
        </div>
        <div className="flex items-center justify-between">
          {view === 'conversations' ? (
            <>
              <span className="font-bold text-ink text-lg tracking-tight">Conversas</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => { setView('contacts'); setSearch('') }}
                  title="Ver contatos"
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-sunken hover:bg-surface-sunken border border-line text-ink-muted hover:text-ink text-xs font-medium transition-colors cursor-pointer"
                >
                  <Users size={12} />
                  Contatos
                </button>
                {onCreateLead && (
                  <button
                    onClick={onCreateLead}
                    title="Novo lead manual"
                    className="w-7 h-7 rounded-lg flex items-center justify-center bg-surface-sunken hover:bg-surface-sunken border border-line text-ink-muted hover:text-ink transition-colors cursor-pointer focus-visible:outline-none"
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
                  className="text-ink-muted hover:text-ink transition-colors cursor-pointer"
                  title="Voltar para conversas"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="font-bold text-ink text-lg tracking-tight">Contatos</span>
              </div>
              <span className="text-ink-subtle text-xs">{filteredContacts.length}</span>
            </>
          )}
        </div>
      </div>

      {/* ── SEARCH ── */}
      <div className="px-3 pb-3 flex-shrink-0">
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 bg-surface-sunken border border-line">
          <Search size={13} className="text-ink-subtle flex-shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={view === 'conversations' ? 'Buscar conversa...' : 'Buscar contato...'}
            className="flex-1 bg-transparent text-ink text-sm placeholder:text-ink-subtle outline-none"
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
                className={`px-2.5 py-1 rounded-full text-2xs font-medium transition-colors cursor-pointer ${
                  !selectedLabelId
                    ? 'bg-line text-ink'
                    : 'bg-surface-sunken text-ink-muted hover:bg-surface-sunken hover:text-ink/60'
                }`}
              >
                Todas
              </button>
              {allLabels.map(label => (
                <button
                  key={label.id}
                  onClick={() => setSelectedLabelId(selectedLabelId === label.id ? null : label.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-2xs font-medium transition-colors cursor-pointer ${
                    selectedLabelId === label.id
                      ? 'bg-line text-ink'
                      : 'bg-surface-sunken text-ink-muted hover:bg-surface-sunken hover:text-ink/60'
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

      <div className="mx-4 mb-1 h-px bg-surface-sunken flex-shrink-0" />

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
                  <p className="px-4 pt-3 pb-2 text-2xs font-bold   text-ink-subtle">
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
                        className={cn('w-full cursor-pointer px-3 py-2.5 text-left flex items-start gap-3 transition-ui', isActive ? 'bg-brand-soft' : 'hover:bg-surface-sunken')}
                        
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-semibold text-white relative"
                          style={{ background: getAvatarColor(lead.name) }}
                        >
                          {getInitials(lead.name)}
                          {unread > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 flex items-center justify-center rounded-full text-2xs font-bold text-white bg-brand">
                              {unread}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className={`text-sm truncate ${isActive ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>
                                {lead.name}
                              </span>
                              {isManual && (
                                <PenLine size={10} className="text-amber-400/80 flex-shrink-0" aria-label="Lead manual" />
                              )}
                              {lead.aceitou_consultor && (
                                <PhoneCall size={10} className="text-emerald-400 flex-shrink-0" aria-label="Quer consultor" />
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {lead.automation_paused
                                ? <PauseCircle size={11} className="text-amber-400/70" />
                                : <Bot size={11} className="text-ink-subtle" />
                              }
                            </div>
                          </div>
                          {lead.aceitou_consultor && (
                            <p className="text-emerald-400/80 text-2xs font-medium mb-0.5">Quer falar com consultor</p>
                          )}
                          <p className="text-ink-subtle text-xs truncate leading-tight">{lead.lastMessage}</p>
                          {lead.lastMessageAt && (
                            <p className="text-ink-subtle text-2xs mt-0.5">
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
                  <p className="text-ink-subtle text-sm">{search ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}</p>
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
                      className={cn('w-full cursor-pointer px-3 py-2.5 text-left flex items-center gap-3 transition-ui', isActive ? 'bg-brand-soft' : 'hover:bg-surface-sunken')}
                      
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-surface-sunken border border-line">
                        <User size={14} className="text-ink-muted" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="font-medium text-ink-muted text-sm truncate">{lead.name}</span>
                          {isManual && (
                            <PenLine size={10} className="text-amber-400/60 flex-shrink-0" aria-label="Lead manual" />
                          )}
                          {lead.aceitou_consultor && (
                            <PhoneCall size={10} className="text-emerald-400 flex-shrink-0" aria-label="Quer consultor" />
                          )}
                          {lead.automation_paused
                            ? <PauseCircle size={11} className="text-amber-400/50 flex-shrink-0 ml-auto" />
                            : <Bot size={11} className="text-ink-subtle flex-shrink-0 ml-auto" />
                          }
                        </div>
                        {lead.aceitou_consultor && (
                          <p className="text-emerald-400/70 text-2xs font-medium mb-0.5">Quer falar com consultor</p>
                        )}
                        <p className="text-ink-subtle text-xs truncate">{lead.phone}</p>
                        {(lead.labels ?? []).length > 0 && (
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            {(lead.labels ?? []).map(label => (
                              <span
                                key={label.id}
                                className="flex items-center gap-0.5 text-2xs font-medium px-1.5 py-0.5 rounded-full"
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
                  <p className="text-ink-subtle text-sm">
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
