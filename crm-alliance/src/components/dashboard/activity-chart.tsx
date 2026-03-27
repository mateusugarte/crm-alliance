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
        borderRadius: 6,
        borderSkipped: false,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: { grid: { display: false }, border: { display: false } },
      y: { grid: { color: '#f0f0f0' }, border: { display: false }, ticks: { stepSize: 1 } },
    },
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-white rounded-2xl p-5 shadow-sm"
    >
      <h3 className="font-semibold text-alliance-dark mb-4">{title}</h3>
      <Bar data={chartData} options={options} />
    </motion.div>
  )
}
