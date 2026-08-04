'use client'

import { BarChart3, ICON } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { ActivityChart } from './activity-chart'
import type { PipelineStage } from '@/app/(protected)/dashboard/page'

interface ChartData {
  labels: string[]
  data: number[]
}

interface ChartsSectionProps {
  leads: ChartData
  pipeline: PipelineStage[]
}

const FUNNEL_KEYS = ['lead_frio', 'lead_morno', 'lead_quente', 'reuniao_agendada']

export function ChartsSection({ leads, pipeline }: ChartsSectionProps) {
  const totalLeads = pipeline.reduce((sum, stage) => sum + stage.count, 0)
  const findStage = (key: string) => pipeline.find(stage => stage.key === key)
  const noResponse = findStage('nao_respondeu')
  const funnelStages = FUNNEL_KEYS
    .map(key => findStage(key))
    .filter((stage): stage is PipelineStage => Boolean(stage))
  const followUp = findStage('follow_up')
  const noInterest = findStage('sem_interesse')
  const sales = (findStage('visita_confirmada')?.count ?? 0) + (findStage('cliente')?.count ?? 0)

  // A escala das barras é relativa à maior etapa, não ao total. Com 676 frios
  // e 1 reunião, escalar pelo total deixaria as três últimas invisíveis.
  const maxCount = Math.max(...funnelStages.map(s => s.count), 1)

  const percentOfBase = (value: number) => totalLeads > 0 ? (value / totalLeads) * 100 : 0
  const formatPercent = (value: number) => {
    if (value > 0 && value < 0.5) return '<1%'
    return `${Math.round(value)}%`
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <section className="min-h-[440px] rounded-[var(--radius-card)] border border-line bg-surface p-5 elev-sm">
        <ActivityChart
          title="Novos leads"
          labels={leads.labels}
          data={leads.data}
          categoryLabel="Dia normal"
          peakLabel="Pico de captação"
        />
      </section>

      <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5 elev-sm">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <BarChart3 size={ICON.md} />
            </span>
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-ink">Funil comercial</h2>
              <p className="text-xs text-ink-muted">Distribuição da base por estágio</p>
            </div>
          </div>
          <div className="text-right">
            <span className="block text-xl font-semibold leading-tight tabular-nums text-ink">
              {totalLeads.toLocaleString('pt-BR')}
            </span>
            <span className="text-xs text-ink-subtle">leads na base</span>
          </div>
        </header>

        {/* Fora do funil — quem nunca respondeu não entrou na qualificação */}
        <div className="mb-5 flex items-center justify-between gap-4 rounded-lg bg-surface-sunken px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Aguardando resposta</p>
            <p className="text-xs text-ink-muted">Ainda fora do fluxo de qualificação</p>
          </div>
          <div className="flex flex-shrink-0 items-baseline gap-2">
            <span className="text-lg font-semibold tabular-nums text-ink">{noResponse?.count ?? 0}</span>
            <span className="text-xs text-ink-subtle">
              {formatPercent(percentOfBase(noResponse?.count ?? 0))} da base
            </span>
          </div>
        </div>

        {/* O funil.
            O trapézio com clip-path que estava aqui cortava o próprio texto
            ("Lead Frio" virava "ead Frio", o percentual sumia na borda) e é uma
            forma que não representa nada: a área do trapézio não corresponde ao
            valor. Barra proporcional corresponde. */}
        <ol className="flex flex-col gap-3">
          {funnelStages.map((stage, index) => {
            const previous = index > 0 ? funnelStages[index - 1] : undefined
            const stepConversion = previous && previous.count > 0
              ? (stage.count / previous.count) * 100
              : null

            return (
              <li key={stage.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: stage.color }}
                    />
                    {stage.label}
                  </span>
                  <span className="flex items-baseline gap-2 whitespace-nowrap">
                    <span className="text-base font-semibold tabular-nums text-ink">
                      {stage.count.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-xs tabular-nums text-ink-subtle">
                      {formatPercent(percentOfBase(stage.count))}
                    </span>
                  </span>
                </div>

                <div
                  className="h-2.5 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: stage.soft }}
                  role="img"
                  aria-label={`${stage.label}: ${stage.count} leads, ${formatPercent(percentOfBase(stage.count))} da base`}
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out-quart)]"
                    style={{
                      width: `${Math.max((stage.count / maxCount) * 100, stage.count > 0 ? 1.5 : 0)}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                </div>

                {stepConversion !== null && previous && (
                  <p className="mt-1 text-xs tabular-nums text-ink-subtle">
                    {formatPercent(stepConversion)} de {previous.label.toLowerCase()}
                  </p>
                )}
              </li>
            )
          })}
        </ol>

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2.5 text-sm font-medium text-ink-muted">Depois da reunião</p>
          <div className="grid grid-cols-3 gap-2">
            <OutcomeMetric
              label="Follow-up"
              value={followUp?.count ?? 0}
              percent={formatPercent(percentOfBase(followUp?.count ?? 0))}
              tokens={followUp}
            />
            <OutcomeMetric
              label="Sem interesse"
              value={noInterest?.count ?? 0}
              percent={formatPercent(percentOfBase(noInterest?.count ?? 0))}
              tokens={noInterest}
            />
            <OutcomeMetric
              label="Vendas"
              value={sales}
              percent={formatPercent(percentOfBase(sales))}
              tokens={findStage('cliente')}
              highlight
            />
          </div>
        </div>
      </section>
    </div>
  )
}

function OutcomeMetric({
  label,
  value,
  percent,
  tokens,
  highlight = false,
}: {
  label: string
  value: number
  percent: string
  tokens?: Pick<PipelineStage, 'color' | 'soft' | 'ink'>
  highlight?: boolean
}) {
  const accent = highlight && tokens ? tokens.ink : undefined

  return (
    <div
      className={cn('rounded-lg px-3 py-2.5', !highlight && 'bg-surface-sunken')}
      style={highlight && tokens ? { backgroundColor: tokens.soft } : undefined}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: accent }}>
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: tokens?.color }}
        />
        <span className={cn('truncate', !highlight && 'text-ink-muted')}>{label}</span>
      </p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-ink" style={{ color: accent }}>
          {value}
        </span>
        <span className="text-xs tabular-nums text-ink-subtle">{percent}</span>
      </div>
    </div>
  )
}
