interface ActivityChartProps {
  title: string
  labels: string[]
  data: number[]
  color?: string
}

export function ActivityChart({ title, labels, data, color = '#1E90FF' }: ActivityChartProps) {
  const max = Math.max(...data, 1)
  const bars = data.length

  return (
    <div className="bg-white rounded-2xl px-6 py-5 shadow-[0_1px_4px_0_rgb(0_0_0_/_0.06)] border border-gray-100/80">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-5">
        {title}
      </h3>

      {/* SVG bars */}
      <div className="relative h-36">
        <svg
          viewBox={`0 0 ${bars * 32} 100`}
          preserveAspectRatio="none"
          className="w-full h-[80%]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="1" />
              <stop offset="100%" stopColor={color} stopOpacity="0.35" />
            </linearGradient>
          </defs>
          {data.map((value, i) => {
            const barH = max === 0 ? 2 : Math.max((value / max) * 88, value > 0 ? 4 : 2)
            const x = i * 32 + 4
            const y = 100 - barH
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={24}
                height={barH}
                rx={4}
                fill={`url(#grad-${title})`}
              />
            )
          })}
        </svg>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between">
          {labels.map((label, i) => (
            <span
              key={i}
              className="text-[10px] text-gray-400 text-center"
              style={{ width: `${100 / bars}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Total */}
      <div className="mt-2 flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="text-xs text-gray-500">
          Total: <strong className="text-gray-700 font-semibold">{data.reduce((a, b) => a + b, 0)}</strong> nos últimos 7 dias
        </span>
      </div>
    </div>
  )
}
