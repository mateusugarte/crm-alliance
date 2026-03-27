'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Phone, MapPin, Home, Target, MessageSquare, Bot } from 'lucide-react'
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <motion.div {...modalAnimationProps}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-alliance-dark">
              {lead.name}
            </DialogTitle>
            <span
              className="inline-flex w-fit items-center px-2 py-0.5 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: STAGE_COLORS[lead.stage] }}
            >
              {STAGE_LABELS[lead.stage]}
            </span>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-4">
            {/* Info básica */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={14} className="text-alliance-blue" />
                {lead.phone}
              </div>
              {lead.city && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={14} className="text-alliance-blue" />
                  {lead.city}
                </div>
              )}
              {lead.imovel_interesse && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Home size={14} className="text-alliance-blue" />
                  {lead.imovel_interesse}
                </div>
              )}
              {lead.intention && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Target size={14} className="text-alliance-blue" />
                  Intenção: {lead.intention === 'morar' ? 'Morar' : 'Investir'}
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MessageSquare size={14} className="text-alliance-blue" />
                {lead.interaction_count} interações · há {tempoNoStage} no stage
              </div>
            </div>

            {/* Resumo IA */}
            <div className="bg-gray-50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Bot size={14} className="text-alliance-dark" />
                <span className="text-xs font-semibold text-alliance-dark">Resumo da IA</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {lead.summary ?? 'Nenhum resumo disponível ainda.'}
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-2">
              <button
                onClick={onAssume}
                className="flex-1 bg-alliance-dark text-white text-sm font-semibold py-2 rounded-xl hover:bg-alliance-dark/90 transition-colors"
              >
                Assumir conversa
              </button>
              <button
                onClick={onTogglePause}
                className={`flex-1 text-sm font-semibold py-2 rounded-xl border transition-colors ${
                  lead.automation_paused
                    ? 'border-alliance-blue text-alliance-blue bg-alliance-blue/10'
                    : 'border-gray-300 text-gray-600 hover:border-alliance-dark hover:text-alliance-dark'
                }`}
              >
                {lead.automation_paused ? 'Retomar automação' : 'Pausar automação'}
              </button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}
