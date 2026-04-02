import { ActivityChart } from './activity-chart'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { CalendarClock, GitBranch } from 'lucide-react'
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

  return (
    <div className="flex flex-col gap-4">
      {/* Gráficos */}
      <div className="grid grid-cols-2 gap-4">
        <ActivityChart
          title="Reuniões — 7 dias"
          labels={reunioes.labels}
          data={reunioes.data}
          color="#0A2EAD"
        />
        <ActivityChart
          title="Novos Leads — 7 dias"
          labels={leads.labels}
          data={leads.data}
          color="#1E90FF"
        />
      </div>

      {/* Seções inferiores */}
      <div className="grid grid-cols-2 gap-4">
        {/* Reuniões de hoje */}
        <div className="bg-white dark:bg-white/5 rounded-2xl px-5 py-5 border border-gray-100 dark:border-white/8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={14} className="text-alliance-blue" />
            <h3 className="text-xs font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest">
              Reuniões de Hoje
            </h3>
          </div>

          {todayMeetings.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-white/30 py-2">
              Nenhuma reunião agendada para hoje.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {todayMeetings.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                  <span className="text-sm font-bold tabular-nums text-alliance-dark dark:text-alliance-blue w-10 flex-shrink-0">
                    {format(new Date(m.datetime), 'HH:mm', { locale: ptBR })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">{m.lead_name}</p>
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

        {/* Mini Pipeline */}
        <div className="bg-white dark:bg-white/5 rounded-2xl px-5 py-5 border border-gray-100 dark:border-white/8 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <GitBranch size={14} className="text-alliance-blue" />
            <h3 className="text-xs font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest">
              Pipeline
            </h3>
          </div>

          {totalLeads === 0 ? (
            <p className="text-sm text-gray-400 dark:text-white/30 py-2">Nenhum lead no pipeline.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {pipeline.filter(s => s.count > 0).map(stage => {
                const pct = Math.round((stage.count / totalLeads) * 100)
                return (
                  <div key={stage.key} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-white/50 w-16 flex-shrink-0 truncate">{stage.label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/8 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: stage.color }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-gray-400 dark:text-white/30 w-6 text-right tabular-nums flex-shrink-0">
                      {stage.count}
                    </span>
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
