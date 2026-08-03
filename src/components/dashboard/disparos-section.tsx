'use client'

import { BarChart3, MessageCircleReply, Send, TrendingUp, Users } from 'lucide-react'
import type { DisparoDashboardData } from '@/app/(protected)/dashboard/page'

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function formatAverage(value: number) {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function StatBlock({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail?: string
}) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/35">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-white">
        {value}
      </p>
      {detail && (
        <p className="mt-1 text-[11px] text-gray-400 dark:text-white/30">
          {detail}
        </p>
      )}
    </div>
  )
}

export function DisparosSection({ data }: { data: DisparoDashboardData }) {
  const max = Math.max(...data.funnel.map(item => item.value), 1)

  return (
    <section className="flex flex-col gap-5">
      <div className="h-px bg-gradient-to-r from-transparent via-gray-100 dark:via-white/[0.06] to-transparent" />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-alliance-blue/10">
            <Send size={14} className="text-alliance-blue" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-white/35">
              Disparos
            </p>
            <p className="text-sm text-gray-500 dark:text-white/45">
              Impacto, resposta e avanço no pipeline
            </p>
          </div>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-gray-500 dark:bg-white/[0.04] dark:text-white/35">
          {data.coldZeroRemaining} leads frios 0× restantes
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <StatBlock
          label="Leads impactados"
          value={data.impactedLeads}
          detail={`${data.totalSent} disparos enviados`}
        />
        <StatBlock
          label="Responderam"
          value={data.respondedLeads}
          detail={`${formatPercent(data.responseRate)} dos impactados`}
        />
        <StatBlock
          label="Avançaram"
          value={data.advancedLeads}
          detail={`${formatPercent(data.advanceRate)} dos impactados`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-lg border border-gray-100 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={15} className="text-alliance-blue" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Funil de Disparos</h2>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-white/30">
              média {formatAverage(data.averageDispatchesPerLead)} disparos/lead
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {data.funnel.map((item, index) => {
              const width = Math.max(14, Math.round((item.value / max) * 100))
              return (
                <div key={item.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-500 dark:text-white/50">{item.label}</span>
                    <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{item.value}</span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-md bg-gray-100 dark:bg-white/[0.06]">
                    <div
                      className="flex h-full items-center justify-end rounded-md px-3 text-[11px] font-bold text-white transition-all duration-700"
                      style={{
                        width: `${width}%`,
                        background: `linear-gradient(90deg, ${item.color}99, ${item.color})`,
                        marginLeft: index === 0 ? 0 : `${Math.min(index * 2, 8)}%`,
                      }}
                    >
                      {formatPercent(item.conversionFromPrevious)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="grid gap-3">
          <StatBlock
            label="Agendaram reunião"
            value={data.meetingLeads}
            detail="Inclui reunião, follow-up, sem interesse e venda"
          />
          <StatBlock
            label="Viraram cliente"
            value={data.clientLeads}
            detail="Clientes atribuídos a disparos"
          />
          <div className="rounded-lg border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
            <div className="flex items-center gap-2 text-gray-500 dark:text-white/45">
              <Users size={14} />
              <span className="text-xs font-semibold">Resumo operacional</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[11px] text-gray-400 dark:text-white/30">Resposta</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  <MessageCircleReply size={13} className="mr-1 inline text-emerald-500" />
                  {formatPercent(data.responseRate)}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 dark:text-white/30">Avanço</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  <TrendingUp size={13} className="mr-1 inline text-alliance-blue" />
                  {formatPercent(data.advanceRate)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

