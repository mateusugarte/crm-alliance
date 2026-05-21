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
    <div className="flex flex-col gap-5">
      {/* Gráficos de barras — sem card wrapper */}
      <div className="grid grid-cols-2 gap-8">
        <ActivityChart
          title="Novos Leads"
          labels={leads.labels}
          data={leads.data}
          categoryLabel="Dia normal"
          peakLabel="Pico de captação"
        />
        <ActivityChart
          title="Reuniões"
          labels={reunioes.labels}
          data={reunioes.data}
          categoryLabel="Dia normal"
          peakLabel="Pico de reuniões"
        />
      </div>

      {/* Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-100 dark:via-white/[0.06] to-transparent" />

      {/* Seções inferiores */}
      <div className="grid grid-cols-2 gap-8">
        {/* Reuniões de hoje */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center">
                <CalendarClock size={12} className="text-purple-500 dark:text-purple-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest">
                Reuniões de Hoje
              </span>
            </div>
            {todayMeetings.length > 0 && (
              <span className="text-[11px] font-bold text-purple-500 dark:text-purple-400 tabular-nums">
                {todayMeetings.length}
              </span>
            )}
          </div>

          {todayMeetings.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-1.5">
              <CalendarClock size={16} className="text-gray-200 dark:text-white/15" />
              <p className="text-[11px] text-gray-300 dark:text-white/20 text-center leading-snug">
                Nenhuma reunião<br />agendada para hoje
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {todayMeetings.map(m => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05]"
                >
                  <div
                    className="flex-shrink-0 px-1.5 py-0.5 rounded-md min-w-[40px] text-center"
                    style={{ backgroundColor: m.consultant_color + '18' }}
                  >
                    <span
                      className="text-[12px] font-bold tabular-nums leading-none block"
                      style={{ color: m.consultant_color }}
                    >
                      {format(new Date(m.datetime), 'HH:mm', { locale: ptBR })}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-gray-800 dark:text-white truncate leading-none">
                      {m.lead_name}
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-white/30 truncate mt-0.5">
                      {m.consultant_name}
                    </p>
                  </div>

                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
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

        {/* Pipeline */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                <BarChart3 size={12} className="text-blue-500 dark:text-blue-400" />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest">
                Pipeline
              </span>
            </div>
            {totalLeads > 0 && (
              <span className="text-[11px] font-bold text-blue-500 dark:text-blue-400 tabular-nums">
                {totalLeads} leads
              </span>
            )}
          </div>

          {totalLeads === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-1.5">
              <BarChart3 size={16} className="text-gray-200 dark:text-white/15" />
              <p className="text-[11px] text-gray-300 dark:text-white/20 text-center leading-snug">
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
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-[11px] font-medium text-gray-500 dark:text-white/50">
                          {stage.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[11px] font-semibold tabular-nums"
                          style={{ color: stage.color }}
                        >
                          {stage.count}
                        </span>
                        <span className="text-[10px] text-gray-300 dark:text-white/20 tabular-nums w-7 text-right">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-[3px] bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${stage.color}99, ${stage.color})`,
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
  )
}
