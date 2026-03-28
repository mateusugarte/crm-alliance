'use client'

import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Phone, MapPin, Home, Target, MessageSquare, Bot, UserCheck, Pause, Play } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
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
  const displayName = lead.name?.trim() || lead.phone || 'Lead sem nome'

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ width: 480, maxWidth: 480 }}
        className="p-0 overflow-y-auto flex flex-col gap-0"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex-shrink-0" style={{ backgroundColor: '#0A2EAD' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">{displayName}</h2>
              <p className="text-white/60 text-xs mt-0.5">{lead.phone}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: stageColor }}
              >
                {STAGE_LABELS[lead.stage]}
              </span>
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors p-1"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 px-6 py-5 flex-1">

          {/* Seção 1: Informações */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Informações</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                <Phone size={13} className="text-alliance-blue flex-shrink-0" />
                <span className="truncate text-xs text-gray-700">{lead.phone}</span>
              </div>
              {lead.city && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <MapPin size={13} className="text-alliance-blue flex-shrink-0" />
                  <span className="truncate text-xs text-gray-700">{lead.city}</span>
                </div>
              )}
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Seção 2: Qualificação */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Qualificação</p>
            <div className="grid grid-cols-2 gap-2">
              {lead.intention && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <Target size={13} className="text-alliance-blue flex-shrink-0" />
                  <span className="text-xs text-gray-700">
                    {lead.intention === 'morar' ? 'Morar' : 'Investir'}
                  </span>
                </div>
              )}
              {lead.imovel_interesse && (
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
                  <Home size={13} className="text-alliance-blue flex-shrink-0" />
                  <span className="truncate text-xs text-gray-700">{lead.imovel_interesse}</span>
                </div>
              )}
              {!lead.intention && !lead.imovel_interesse && (
                <p className="text-xs text-gray-400 col-span-2">Nenhuma qualificação registrada.</p>
              )}
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Seção 3: Automação */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Automação</p>
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {lead.automation_paused ? 'IA pausada' : 'IA ativa'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {lead.automation_paused
                    ? 'Respostas automáticas suspensas'
                    : 'Respondendo automaticamente'}
                </p>
              </div>
              <button
                onClick={onTogglePause}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  lead.automation_paused
                    ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
                }`}
              >
                {lead.automation_paused
                  ? <><Play size={12} /> Retomar</>
                  : <><Pause size={12} /> Pausar</>
                }
              </button>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Seção 4: Resumo IA */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Resumo da IA</p>
            <div className="bg-alliance-dark/5 border border-alliance-dark/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Bot size={13} className="text-alliance-dark" />
                <span className="text-xs font-bold text-alliance-dark uppercase tracking-wider">Análise</span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                {lead.summary ?? 'Nenhum resumo disponível ainda.'}
              </p>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Seção 5: Métricas */}
          <section>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Métricas</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                <p className="text-2xl font-bold text-alliance-dark">{lead.interaction_count}</p>
                <p className="text-xs text-gray-400 mt-0.5">interações</p>
              </div>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-center">
                <p className="text-xs font-bold text-alliance-dark">
                  {new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </p>
                <p className="text-xs text-gray-400 mt-1">cadastro</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl px-4 py-2.5 mt-2">
              <div className="flex items-center gap-2">
                <MessageSquare size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500">há {tempoNoStage} neste estágio</span>
              </div>
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Seção 6: Ações */}
          <section className="pb-2">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Ações</p>
            <div className="flex gap-2">
              <button
                onClick={onAssume}
                className="flex-1 flex items-center justify-center gap-2 bg-alliance-dark text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-alliance-dark/90 transition-colors"
              >
                <UserCheck size={15} />
                Assumir conversa
              </button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
