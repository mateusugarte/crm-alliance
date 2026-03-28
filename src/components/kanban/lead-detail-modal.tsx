'use client'

import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Phone, MapPin, Home, Target, MessageSquare, Bot, UserCheck, Pause, Play } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { modalAnimationProps } from '@/lib/animations'
import type { Lead } from '@/lib/supabase/types'

const STAGE_LABELS: Record<Lead['stage'], string> = {
  lead_frio: 'Lead Frio',
  lead_morno: 'Lead Morno',
  lead_quente: 'Lead Quente',
  follow_up: 'Follow Up',
  reuniao_agendada: 'Reunião Agendada',
  visita_confirmada: 'Visita Confirmada',
  cliente: 'Cliente',
}

const STAGE_COLORS: Record<Lead['stage'], string> = {
  lead_frio: '#1E90FF',
  lead_morno: '#FF8C00',
  lead_quente: '#FF4500',
  follow_up: '#9B59B6',
  reuniao_agendada: '#228B22',
  visita_confirmada: '#E67E22',
  cliente: '#2ECC71',
}

interface LeadDetailModalProps {
  lead: Lead | null
  open: boolean
  onClose: () => void
  onAssume?: () => void
  onTogglePause?: () => void
}

export function LeadDetailModal({ lead, open, onClose, onAssume, onTogglePause }: LeadDetailModalProps) {
  if (!lead) return null

  const tempoNoStage = formatDistanceToNow(new Date(lead.updated_at), {
    locale: ptBR,
    addSuffix: false,
  })

  const stageColor = STAGE_COLORS[lead.stage]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden gap-0">
        <motion.div {...modalAnimationProps}>
          {/* Header colorido */}
          <div
            className="px-6 pt-6 pb-5"
            style={{ background: `linear-gradient(135deg, ${stageColor}15, ${stageColor}05)` }}
          >
            <DialogHeader>
              <div className="flex items-start justify-between gap-3">
                <DialogTitle className="text-xl font-bold text-alliance-dark leading-tight">
                  {lead.name}
                </DialogTitle>
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: stageColor }}
                >
                  {STAGE_LABELS[lead.stage]}
                </span>
              </div>
            </DialogHeader>
          </div>

          {/* Corpo */}
          <div className="flex flex-col gap-5 px-6 pb-6 pt-4">
            {/* Info básica */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5">
                <Phone size={13} className="text-alliance-blue flex-shrink-0" />
                <span className="truncate text-xs">{lead.phone}</span>
              </div>
              {lead.city && (
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5">
                  <MapPin size={13} className="text-alliance-blue flex-shrink-0" />
                  <span className="truncate text-xs">{lead.city}</span>
                </div>
              )}
              {lead.imovel_interesse && (
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5">
                  <Home size={13} className="text-alliance-blue flex-shrink-0" />
                  <span className="truncate text-xs">{lead.imovel_interesse}</span>
                </div>
              )}
              {lead.intention && (
                <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5">
                  <Target size={13} className="text-alliance-blue flex-shrink-0" />
                  <span className="truncate text-xs">
                    {lead.intention === 'morar' ? 'Morar' : 'Investir'}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2.5 col-span-2">
                <MessageSquare size={13} className="text-alliance-blue flex-shrink-0" />
                <span className="text-xs">
                  {lead.interaction_count} interações · há {tempoNoStage} neste estágio
                </span>
              </div>
            </div>

            {/* Resumo IA */}
            <div className="bg-alliance-dark/5 border border-alliance-dark/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={13} className="text-alliance-dark" />
                <span className="text-xs font-bold text-alliance-dark uppercase tracking-wider">
                  Resumo da IA
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {lead.summary ?? 'Nenhum resumo disponível ainda.'}
              </p>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2">
              <button
                onClick={onAssume}
                className="flex-1 flex items-center justify-center gap-2 bg-alliance-dark text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-alliance-dark/90 transition-colors"
              >
                <UserCheck size={15} />
                Assumir
              </button>
              <button
                onClick={onTogglePause}
                className={`flex-1 flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl border transition-colors ${
                  lead.automation_paused
                    ? 'border-alliance-blue bg-alliance-blue/10 text-alliance-blue hover:bg-alliance-blue/15'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {lead.automation_paused
                  ? <><Play size={15} /> Retomar IA</>
                  : <><Pause size={15} /> Pausar IA</>
                }
              </button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
