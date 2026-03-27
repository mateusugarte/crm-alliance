'use client'

import { ActivityChart } from './activity-chart'

const MONTHS = ['Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev']

export function ChartsSection() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <ActivityChart
        title="Reuniões por Mês"
        labels={MONTHS}
        data={[4, 7, 5, 9, 6, 8]}
      />
      <ActivityChart
        title="Leads por Mês"
        labels={MONTHS}
        data={[12, 18, 14, 22, 16, 20]}
      />
    </div>
  )
}
