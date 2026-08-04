'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MapPin, Home, Zap, PauseCircle, User, Calendar, MessageSquare, Pencil, Check, UserCheck } from '@/lib/icons'
import { LeadCommentsSection } from '@/components/shared/lead-comments-section'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { formatPhone } from '@/lib/format-phone'
import { stageTokens } from '@/lib/stages'
import type { LeadWithLastInteraction } from './types'

const STAGE_LABELS: Record<string, string> = {
  nao_respondeu: 'Não Respondeu',
  lead_frio: 'Lead Frio',
  lead_morno: 'Lead Morno',
  lead_quente: 'Lead Quente',
  follow_up: 'Follow Up',
  sem_interesse: 'Sem interesse',
  reuniao_agendada: 'Reunião Agendada',
  visita_confirmada: 'Venda Confirmada',
  cliente: 'Cliente',
}
// Cor do estágio vem de @/lib/stages — fonte única do sistema.

function getAvatarColor(name: string) {
  const colors = [
    'var(--brand)',
    'var(--stage-follow-up)',
    'var(--stage-cliente)',
    'var(--stage-morno)',
    'var(--stage-quente)',
    'var(--stage-sem-interesse)',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}
function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

interface LeadInfoPanelProps {
  lead: LeadWithLastInteraction
  open: boolean
  onClose: () => void
  onLeadUpdated: (updated: Partial<LeadWithLastInteraction>) => void
  currentUserId: string
}

export function LeadInfoPanel({ lead, open, onClose, onLeadUpdated, currentUserId }: LeadInfoPanelProps) {
  const [assumindo, setAssumindo] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(lead.name)

  const stage = stageTokens(lead.stage)
  const stageColor = stage.solid
  const stageLabel = STAGE_LABELS[lead.stage] ?? lead.stage

  const handleAssume = async () => {
    setAssumindo(true)
    try {
      const results = await Promise.allSettled([
        // 1. Atribui ao usuário logado
        fetch(`/api/leads/${lead.id}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_to: currentUserId }),
        }),
        // 2. Pausa a IA se ainda não estiver pausada
        !lead.automation_paused
          ? fetch(`/api/leads/${lead.id}/pause`, { method: 'POST' })
          : Promise.resolve({ ok: true }),
      ])

      const failed = results.some(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))
      if (failed) throw new Error()

      onLeadUpdated({ assigned_to: currentUserId, automation_paused: true })
      toast.success('Conversa assumida — IA pausada')
    } catch {
      toast.error('Erro ao assumir conversa.')
    } finally {
      setAssumindo(false)
    }
  }

  const handleSaveName = async () => {
    if (!nameValue.trim() || nameValue === lead.name) { setEditingName(false); return }
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: nameValue.trim() }),
      })
      if (!res.ok) throw new Error()
      const json = await res.json() as { data?: { name?: string } }
      const normalizedName = json.data?.name ?? nameValue.trim()
      setNameValue(normalizedName)
      onLeadUpdated({ name: normalizedName })
      toast.success('Nome atualizado')
    } catch {
      toast.error('Erro ao salvar nome.')
      setNameValue(lead.name)
    }
    setEditingName(false)
  }

  const isAssumed = lead.assigned_to === currentUserId && lead.automation_paused

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/20 dark:bg-black/40 z-20"
            onClick={onClose}
          />

          {/* Painel */}
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="absolute right-0 top-0 bottom-0 w-80 z-30 flex flex-col bg-surface border-l border-line shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-start justify-between flex-shrink-0 border-b border-line">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base"
                  style={{ background: getAvatarColor(lead.name) }}
                >
                  {getInitials(lead.name)}
                </div>
                <div className="min-w-0">
                  {editingName ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        value={nameValue}
                        onChange={e => setNameValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false) }}
                        className="font-bold text-sm text-ink bg-surface-sunken border border-line rounded-lg px-2 py-1 outline-none w-36"
                      />
                      <button onClick={handleSaveName} className="text-emerald-500 hover:text-emerald-600">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-ink leading-tight truncate max-w-[160px]">
                        {lead.name}
                      </h3>
                      <button
                        onClick={() => { setEditingName(true); setNameValue(lead.name) }}
                        className="text-ink-subtle hover:text-ink-muted dark:hover:text-white/50 transition-colors"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                  )}
                  <p className="text-ink-subtle text-xs mt-0.5">{formatPhone(lead.phone)}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-subtle hover:text-ink dark:hover:text-white hover:bg-surface-sunken dark:hover:bg-white/8 transition-all"
              >
                <X size={15} />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

              {/* Stage */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-subtle  ">Estágio</span>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: stageColor }}
                >
                  {stageLabel}
                </span>
              </div>

              {/* Status IA */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink-subtle  ">Automação</span>
                {lead.automation_paused ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-400/20">
                    <PauseCircle size={11} /> Pausada
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-alliance-blue/10 text-alliance-blue border border-alliance-blue/20">
                    <Zap size={11} /> IA Ativa
                  </span>
                )}
              </div>

              <div className="h-px bg-surface-sunken" />

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface-sunken border border-line p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-ink-subtle">
                    <MessageSquare size={11} />
                    <span className="text-2xs font-semibold  ">Mensagens</span>
                  </div>
                  <span className="text-xl font-bold text-ink tabular-nums">{lead.interaction_count}</span>
                </div>
                <div className="rounded-xl bg-surface-sunken border border-line p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-ink-subtle">
                    <Calendar size={11} />
                    <span className="text-2xs font-semibold  ">Entrada</span>
                  </div>
                  <span className="text-sm font-bold text-ink">
                    {format(new Date(lead.created_at), 'dd/MM/yy', { locale: ptBR })}
                  </span>
                </div>
              </div>

              {/* Detalhes */}
              <div className="flex flex-col gap-2.5">
                {lead.city && (
                  <div className="flex items-center gap-2.5">
                    <MapPin size={13} className="text-ink-subtle flex-shrink-0" />
                    <span className="text-sm text-ink">{lead.city}</span>
                  </div>
                )}
                {lead.intention && (
                  <div className="flex items-center gap-2.5">
                    <User size={13} className="text-ink-subtle flex-shrink-0" />
                    <span className="text-sm text-ink capitalize">{lead.intention}</span>
                  </div>
                )}
                {lead.imovel_interesse && (
                  <div className="flex items-center gap-2.5">
                    <Home size={13} className="text-alliance-blue flex-shrink-0" />
                    <span className="text-sm text-alliance-blue font-medium">{lead.imovel_interesse}</span>
                  </div>
                )}
              </div>

              {/* Summary */}
              {lead.summary && (
                <div className="rounded-xl bg-surface-sunken border border-line p-3">
                  <p className="text-2xs font-bold text-ink-subtle   mb-1.5">Resumo IA</p>
                  <p className="text-xs text-ink leading-relaxed">{lead.summary}</p>
                </div>
              )}

              {/* Comentários internos */}
              <div className="h-px bg-surface-sunken" />
              <div>
                <p className="text-2xs font-bold text-ink-subtle   mb-2">
                  Comentários internos
                </p>
                <LeadCommentsSection
                  leadId={lead.id}
                  currentUserId={currentUserId}
                />
              </div>
            </div>

            {/* Footer — Assumir */}
            <div className="px-5 py-4 flex-shrink-0 border-t border-line">
              {isAssumed ? (
                <div className="w-full rounded-xl py-3 flex items-center justify-center gap-2 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <UserCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Conversa assumida</span>
                </div>
              ) : (
                <button
                  onClick={handleAssume}
                  disabled={assumindo}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
                  style={{ background: 'var(--brand)' }}
                >
                  {assumindo ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <UserCheck size={15} />
                  )}
                  {assumindo ? 'Assumindo...' : 'Assumir conversa'}
                </button>
              )}
              <p className="text-2xs text-ink-subtle text-center mt-2">
                Pausará a IA e atribuirá a você
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
