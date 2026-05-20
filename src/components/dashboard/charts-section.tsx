import { ActivityChart } from './activity-chart'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock, BarChart3 } from 'lucide-react'
import type { TodayMeeting, PipelineStage } from '@/app/(protected)/dashboard/page'

interface ChartData {
  labels: string[]
  data: number[]
}

interface ChartsSectionProps {
  reunioes: ChartData
  leads: ChartData
  todayMeetings: TodayMeeting[]
  pipeline: PipelineStage[]
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
}

export function ChartsSection({ reunioes, leads, todayMeetings, pipeline }: ChartsSectionProps) {
  const totalLeads = pipeline.reduce((s, p) => s + p.count, 0)
  const activePipeline = pipeline.filter(s => s.count > 0)

  return (
    <div className="flex flex-col gap-4">
      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-4">
        <ActivityChart
          title="Novos Leads"
          subtitle="Captações no período"
          labels={leads.labels}
          data={leads.data}
          color="#1E90FF"
          colorEnd="#0A2EAD"
        />
        <ActivityChart
          title="Reuniões"
          subtitle="Agendamentos no período"
          labels={reunioes.labels}
          data={reunioes.data}
          color="#9B59B6"
          colorEnd="#7B2FBE"
        />
      </div>

      {/* Seções inferiores */}
      <div className="grid grid-cols-2 gap-4">
        {/* Reuniões de hoje */}
        <div
          className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/8 overflow-hidden flex flex-col"
          style={{ boxShadow: '0 2px 16px 0 rgb(0 0 0 / 0.05)' }}
        >
          {/* Top accent */}
          <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #9B59B6, #E67E22)' }} />

          <div className="px-5 pt-4 pb-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                  <CalendarClock size={13} className="text-purple-500 dark:text-purple-400" />
                </div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-widest">
                  Reuniões de Hoje
                </h3>
              </div>
              {todayMeetings.length > 0 && (
                <span className="text-xs font-bold text-purple-500 dark:text-purple-400 tabular-nums">
                  {todayMeetings.length}
                </span>
              )}
            </div>

            {todayMeetings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-6 gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                  <CalendarClock size={18} className="text-gray-300 dark:text-white/20" />
                </div>
                <p className="text-xs text-gray-400 dark:text-white/25 text-center">
                  Nenhuma reunião<br />agendada para hoje
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {todayMeetings.map(m => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06]"
                  >
                    {/* Time badge */}
                    <div
                      className="flex-shrink-0 px-2 py-1 rounded-lg text-center min-w-[46px]"
                      style={{ backgroundColor: m.consultant_color + '18' }}
                    >
                      <span
                        className="text-[13px] font-bold tabular-nums block leading-none"
                        style={{ color: m.consultant_color }}
                      >
                        {format(new Date(m.datetime), 'HH:mm', { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-white truncate leading-snug">
                        {m.lead_name}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-white/30 truncate mt-0.5">
                        {m.consultant_name}
                      </p>
                    </div>

                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm"
                      style={{ backgroundColor: m.consultant_color }}
                      title={m.consultant_name}
                    >
                      {getInitials(m.consultant_name)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pipeline */}
        <div
          className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/8 overflow-hidden flex flex-col"
          style={{ boxShadow: '0 2px 16px 0 rgb(0 0 0 / 0.05)' }}
        >
          {/* Top accent */}
          <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #1E90FF, #2ECC71)' }} />

          <div className="px-5 pt-4 pb-5 flex flex-col gap-3 flex-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <BarChart3 size={13} className="text-blue-500 dark:text-blue-400" />
                </div>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-widest">
                  Pipeline
                </h3>
              </div>
              {totalLeads > 0 && (
                <span className="text-xs font-bold text-blue-500 dark:text-blue-400 tabular-nums">
                  {totalLeads} leads
                </span>
              )}
            </div>

            {totalLeads === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-6 gap-2">
                <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-white/5 flex items-center justify-center">
                  <BarChart3 size={18} className="text-gray-300 dark:text-white/20" />
                </div>
                <p className="text-xs text-gray-400 dark:text-white/25 text-center">
                  Nenhum lead<br />no pipeline
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {activePipeline.map(stage => {
                  const pct = Math.round((stage.count / totalLeads) * 100)
                  return (
                    <div key={stage.key}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="text-[11px] font-medium text-gray-600 dark:text-white/60">
                            {stage.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[11px] font-bold tabular-nums"
                            style={{ color: stage.color }}
                          >
                            {stage.count}
                          </span>
                          <span className="text-[10px] text-gray-400 dark:text-white/25 tabular-nums w-7 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${stage.color}CC, ${stage.color})`,
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
