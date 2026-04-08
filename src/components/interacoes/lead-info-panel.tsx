'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MapPin, Home, Zap, PauseCircle, User, Calendar, MessageSquare, Pencil, Check, UserCheck } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { formatPhone } from '@/lib/format-phone'
import type { LeadWithLastInteraction } from './types'

const STAGE_LABELS: Record<string, string> = {
  nao_respondeu: 'Não Respondeu',
  lead_frio: 'Lead Frio',
  lead_morno: 'Lead Morno',
  lead_quente: 'Lead Quente',
  follow_up: 'Follow Up',
  reuniao_agendada: 'Reunião Agendada',
  visita_confirmada: 'Visita Confirmada',
  cliente: 'Cliente',
}
const STAGE_COLORS: Record<string, string> = {
  nao_respondeu: '#6B7280',
  lead_frio: '#1E90FF',
  lead_morno: '#FF8C00',
  lead_quente: '#FF4500',
  follow_up: '#9B59B6',
  reuniao_agendada: '#228B22',
  visita_confirmada: '#E67E22',
  cliente: '#2ECC71',
}

function getAvatarColor(name: string) {
  const colors = [
    'linear-gradient(135deg, #1E90FF 0%, #0A2EAD 100%)',
    'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    'linear-gradient(135deg, #EC4899 0%, #DB2777 100%)',
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

  const stageColor = STAGE_COLORS[lead.stage] ?? '#6B7280'
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
      onLeadUpdated({ name: nameValue.trim() })
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
            className="absolute right-0 top-0 bottom-0 w-80 z-30 flex flex-col bg-white dark:bg-[#0F1117] border-l border-gray-100 dark:border-white/5 shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 flex items-start justify-between flex-shrink-0 border-b border-gray-100 dark:border-white/5">
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
                        className="font-bold text-sm text-gray-900 dark:text-white bg-gray-100 dark:bg-white/8 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1 outline-none w-36"
                      />
                      <button onClick={handleSaveName} className="text-emerald-500 hover:text-emerald-600">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight truncate max-w-[160px]">
                        {lead.name}
                      </h3>
                      <button
                        onClick={() => { setEditingName(true); setNameValue(lead.name) }}
                        className="text-gray-300 dark:text-white/20 hover:text-gray-500 dark:hover:text-white/50 transition-colors"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                  )}
                  <p className="text-gray-400 dark:text-white/35 text-xs mt-0.5">{formatPhone(lead.phone)}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 dark:text-white/30 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/8 transition-all"
              >
                <X size={15} />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">

              {/* Stage */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wider">Estágio</span>
                <span
                  className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                  style={{ backgroundColor: stageColor }}
                >
                  {stageLabel}
                </span>
              </div>

              {/* Status IA */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 dark:text-white/35 uppercase tracking-wider">Automação</span>
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

              <div className="h-px bg-gray-100 dark:bg-white/5" />

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 dark:bg-white/4 border border-gray-100 dark:border-white/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-gray-400 dark:text-white/35">
                    <MessageSquare size={11} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Mensagens</span>
                  </div>
                  <span className="text-xl font-bold text-gray-900 dark:text-white tabular-nums">{lead.interaction_count}</span>
                </div>
                <div className="rounded-xl bg-gray-50 dark:bg-white/4 border border-gray-100 dark:border-white/5 p-3 flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-gray-400 dark:text-white/35">
                    <Calendar size={11} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Entrada</span>
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {format(new Date(lead.created_at), 'dd/MM/yy', { locale: ptBR })}
                  </span>
                </div>
              </div>

              {/* Detalhes */}
              <div className="flex flex-col gap-2.5">
                {lead.city && (
                  <div className="flex items-center gap-2.5">
                    <MapPin size={13} className="text-gray-300 dark:text-white/25 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-white/70">{lead.city}</span>
                  </div>
                )}
                {lead.intention && (
                  <div className="flex items-center gap-2.5">
                    <User size={13} className="text-gray-300 dark:text-white/25 flex-shrink-0" />
                    <span className="text-sm text-gray-700 dark:text-white/70 capitalize">{lead.intention}</span>
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
                <div className="rounded-xl bg-gray-50 dark:bg-white/4 border border-gray-100 dark:border-white/5 p-3">
                  <p className="text-[10px] font-bold text-gray-400 dark:text-white/30 uppercase tracking-wider mb-1.5">Resumo IA</p>
                  <p className="text-xs text-gray-600 dark:text-white/55 leading-relaxed">{lead.summary}</p>
                </div>
              )}
            </div>

            {/* Footer — Assumir */}
            <div className="px-5 py-4 flex-shrink-0 border-t border-gray-100 dark:border-white/5">
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
                  style={{ background: 'linear-gradient(135deg, #1E90FF 0%, #0A2EAD 100%)' }}
                >
                  {assumindo ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <UserCheck size={15} />
                  )}
                  {assumindo ? 'Assumindo...' : 'Assumir conversa'}
                </button>
              )}
              <p className="text-[10px] text-gray-300 dark:text-white/20 text-center mt-2">
                Pausará a IA e atribuirá a você
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
