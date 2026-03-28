'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { getAllianceBlue, getAllianceDark } from '@/lib/tokens'
import { cn } from '@/lib/utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
)

interface ActivityChartProps {
  title: string
  labels: string[]
  data: number[]
  /** Quando true: estilo diferenciado para gráfico de Reuniões */
  variant?: 'reunioes' | 'leads'
}

export function ActivityChart({ title, labels, data, variant = 'leads' }: ActivityChartProps) {
  const [blueColor, setBlueColor] = useState(getAllianceBlue())
  const [darkColor, setDarkColor] = useState(getAllianceDark())

  useEffect(() => {
    setBlueColor(getAllianceBlue())
    setDarkColor(getAllianceDark())
  }, [])

  // Segundo dataset tracejado: semana anterior (deslocado -1 em cada ponto como simulação)
  const previousWeekData = data.map((v, i) => {
    const prev = data[i > 0 ? i - 1 : 0]
    return Math.max(0, Math.round(prev * 0.85))
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Esta semana',
        data,
        backgroundColor: blueColor,
        hoverBackgroundColor: darkColor,
        borderRadius: 8,
        borderSkipped: false,
      },
      {
        label: 'Semana anterior',
        data: previousWeekData,
        backgroundColor: 'transparent',
        borderColor: darkColor,
        borderWidth: 2,
        borderDash: [4, 4],
        borderRadius: 8,
        borderSkipped: false,
        type: 'bar' as const,
        // Barras fantasmas — mais finas via categoryPercentage
        categoryPercentage: 0.6,
        barPercentage: 0.5,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: darkColor,
        titleColor: '#fff',
        bodyColor: '#fff',
        cornerRadius: 8,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#9CA3AF', font: { size: 12 } },
      },
      y: {
        grid: { color: '#F3F4F6' },
        border: { display: false },
        ticks: { stepSize: 5, color: '#9CA3AF', font: { size: 12 } },
      },
    },
  }

  const isReunioes = variant === 'reunioes'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'rounded-2xl px-6 py-5',
        isReunioes
          ? 'bg-alliance-dark/[0.03] border border-alliance-blue/10'
          : 'bg-white shadow-card'
      )}
    >
      <h3
        className={cn(
          'mb-4 uppercase tracking-widest',
          isReunioes
            ? 'text-title text-alliance-blue'
            : 'text-subtitle text-gray-600'
        )}
      >
        {title}
      </h3>
      <Bar data={chartData} options={options} />
    </motion.div>
  )
}
