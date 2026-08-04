'use client'

import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  type ChartOptions,
} from 'chart.js'
import { useCssVars } from '@/lib/use-css-vars'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

interface ActivityChartProps {
  title: string
  labels: string[]
  data: number[]
  totalOverride?: number
  categoryLabel?: string
  peakLabel?: string
}

export function ActivityChart({
  title,
  labels,
  data,
  totalOverride,
  categoryLabel = 'Dia normal',
  peakLabel = 'Pico',
}: ActivityChartProps) {
  // O canvas não entende `var(--…)`, então as cores são resolvidas aqui.
  // Antes eram dois hex fixos (#78A9E6 / #F26B3A) que não existiam em lugar
  // nenhum do sistema e não mudavam com o tema.
  const color = useCssVars({
    normal: '--chart-1',
    peak: '--stage-quente',
    grid: '--line',
    axis: '--ink-subtle',
    tooltipBg: '--ink',
    tooltipText: '--surface',
    tooltipMuted: '--ink-subtle',
  })

  const dataTotal = data.reduce((a, b) => a + b, 0)
  const total = totalOverride ?? dataTotal
  const averagePerDay = data.length > 0 ? dataTotal / data.length : 0
  const peakValue = data.length > 0 ? Math.max(...data) : 0
  const peakIndex = data.indexOf(peakValue)
  const peakDay = peakValue > 0 ? labels[peakIndex] ?? '—' : '—'
  const activeDays = data.filter(value => value > 0).length
  const threshold = averagePerDay * 2

  const backgroundColors = data.map(v =>
    threshold > 0 && v > threshold ? color.peak : color.normal,
  )

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: backgroundColors,
        borderRadius: 4,
        borderSkipped: 'start' as const,
        maxBarThickness: 22,
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400, easing: 'easeOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: color.tooltipBg,
        titleColor: color.tooltipText,
        bodyColor: color.tooltipMuted,
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (ctx) => `${ctx.parsed.y} ${title.toLowerCase()}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'inherit' },
          color: color.axis,
          maxRotation: 0,
          autoSkipPadding: 12,
        },
      },
      y: {
        grid: { color: color.grid, drawTicks: false },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'inherit' },
          color: color.axis,
          padding: 6,
          callback: (v) => Number.isInteger(v) ? v : '',
        },
        beginAtZero: true,
      },
    },
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
          <p className="text-xs text-ink-muted">Captação por dia no período</p>
        </div>
        <span className="text-xl font-semibold leading-none tabular-nums text-ink">
          {total.toLocaleString('pt-BR')}
        </span>
      </header>

      <div className="relative h-[190px]">
        <Bar data={chartData} options={options} />
      </div>

      <div className="mt-3 flex gap-4">
        <LegendDot color={color.normal} label={categoryLabel} />
        <LegendDot color={color.peak} label={peakLabel} />
      </div>

      <div className="mt-auto grid grid-cols-3 gap-3 border-t border-line pt-4">
        <SummaryMetric
          label="Média por dia"
          value={averagePerDay.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
        />
        <SummaryMetric label="Melhor dia" value={String(peakValue)} detail={peakDay} />
        <SummaryMetric label="Dias com captação" value={String(activeDays)} detail={`de ${data.length}`} />
      </div>
    </div>
  )
}

function SummaryMetric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-ink-muted">{label}</p>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-lg font-semibold tabular-nums text-ink">{value}</span>
        {detail && <span className="truncate text-xs text-ink-subtle">{detail}</span>}
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-ink-muted">
      <span
        aria-hidden
        className="block h-2.5 w-2.5 flex-shrink-0 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}
