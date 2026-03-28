'use client'

import { useEffect, useState } from 'react'
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
import { getAllianceBlue, getAllianceDark } from '@/lib/tokens'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface ActivityChartProps {
  title: string
  labels: string[]
  data: number[]
}

export function ActivityChart({ title, labels, data }: ActivityChartProps) {
  // Lê os tokens de cor em runtime para respeitar dark mode e custom properties
  const [blueColor, setBlueColor] = useState(getAllianceBlue())
  const [darkColor, setDarkColor] = useState(getAllianceDark())

  useEffect(() => {
    setBlueColor(getAllianceBlue())
    setDarkColor(getAllianceDark())
  }, [])

  const chartData = {
    labels,
    datasets: [
      {
        data,
        backgroundColor: blueColor,
        hoverBackgroundColor: darkColor,
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
        // Usa var CSS para compatibilidade com dark mode quando Chart.js re-renderiza
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
      className="bg-white rounded-2xl px-6 py-5 shadow-card"
    >
      {/* Título: escala semântica text-label */}
      <h3 className="text-label text-alliance-dark uppercase tracking-widest mb-4">
        {title}
      </h3>
      <Bar data={chartData} options={options} />
    </motion.div>
  )
}
