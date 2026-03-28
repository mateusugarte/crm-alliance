'use client'

import { motion } from 'framer-motion'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface ActivityChartProps {
  title: string
  labels: string[]
  data: number[]
}

export function ActivityChart({ title, labels, data }: ActivityChartProps) {
  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: '#1E90FF',
        hoverBackgroundColor: '#0A2EAD',
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        backgroundColor: '#0A2EAD',
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white rounded-2xl px-6 py-5 shadow-sm border border-gray-100"
    >
      <h3 className="text-sm font-semibold text-alliance-dark uppercase tracking-wider mb-4">
        {title}
      </h3>
      <Bar data={chartData} options={options} />
    </motion.div>
  )
}
