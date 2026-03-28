'use client'

import { ActivityChart } from './activity-chart'

interface ChartData {
  labels: string[]
  data: number[]
}

interface ChartsSectionProps {
  reunioes: ChartData
  leads: ChartData
}

export function ChartsSection({ reunioes, leads }: ChartsSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ActivityChart
        title="Reuniões (últimos 7 dias)"
        labels={reunioes.labels}
        data={reunioes.data}
        variant="reunioes"
      />
      <ActivityChart
        title="Leads (últimos 7 dias)"
        labels={leads.labels}
        data={leads.data}
        variant="leads"
      />
    </div>
  )
}
