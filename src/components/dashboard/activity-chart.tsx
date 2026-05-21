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

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

const COLOR_NORMAL = '#85B7EB'
const COLOR_PEAK   = '#D85A30'

interface ActivityChartProps {
  title: string
  labels: string[]
  data: number[]
  categoryLabel?: string
  peakLabel?: string
}

export function ActivityChart({
  title,
  labels,
  data,
  categoryLabel = 'Dia normal',
  peakLabel = 'Pico',
}: ActivityChartProps) {
  const total = data.reduce((a, b) => a + b, 0)
  const avg   = data.length > 0 ? total / data.length : 0
  const threshold = avg * 2

  const backgroundColors = data.map(v =>
    threshold > 0 && v > threshold ? COLOR_PEAK : COLOR_NORMAL
  )

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: backgroundColors,
        borderRadius: 4,
        borderSkipped: 'start' as const,
      },
    ],
  }

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#18181b',
        titleColor: '#ffffff',
        bodyColor: '#a1a1aa',
        padding: 10,
        cornerRadius: 6,
        displayColors: false,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (ctx) => `${ctx.parsed.y}  ${title}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'inherit' },
          color: '#888',
          maxRotation: 0,
        },
      },
      y: {
        grid: {
          color: 'rgba(128,128,128,0.08)',
          drawTicks: false,
        },
        border: { display: false },
        ticks: {
          font: { size: 11, family: 'inherit' },
          color: '#888',
          padding: 6,
          callback: (v) => Number.isInteger(v) ? v : '',
        },
        beginAtZero: true,
      },
    },
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span style={{ fontSize: 13, color: '#888', fontWeight: 500 }}>
          {title}
        </span>
        <span
          style={{
            fontSize: 26,
            fontWeight: 500,
            color: '#185FA5',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {total}
        </span>
      </div>

      {/* Canvas */}
      <div style={{ position: 'relative', height: 220 }}>
        <Bar data={chartData} options={options} />
      </div>

      {/* HTML Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
        <LegendDot color={COLOR_NORMAL} label={categoryLabel} />
        <LegendDot color={COLOR_PEAK}   label={peakLabel} />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          backgroundColor: color,
          display: 'block',
          flexShrink: 0,
        }}
      />
      <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
    </div>
  )
}
