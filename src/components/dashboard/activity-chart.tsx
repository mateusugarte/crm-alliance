interface ActivityChartProps {
  title: string
  labels: string[]
  data: number[]
  color?: string
}

export function ActivityChart({ title, labels, data, color = '#1E90FF' }: ActivityChartProps) {
  const max = Math.max(...data, 1)
  const bars = data.length
  const W = bars * 36
  const H = 80

  // Pontos para o path de área
  const pts = data.map((v, i) => {
    const x = i * 36 + 18
    const y = H - Math.max((v / max) * (H - 8), v > 0 ? 4 : 0)
    return { x, y, v }
  })

  // Path da linha
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  // Path da área preenchida
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H} L ${pts[0].x} ${H} Z`

  const total = data.reduce((a, b) => a + b, 0)

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl px-5 py-5 border border-gray-100 dark:border-white/8">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest">
          {title}
        </h3>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {total}
        </span>
      </div>

      <div className="relative" style={{ height: H + 28 }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          style={{ width: '100%', height: H }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`area-${title.replace(/\s/g, '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Área preenchida */}
          <path
            d={areaPath}
            fill={`url(#area-${title.replace(/\s/g, '')})`}
          />
          {/* Linha */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Pontos e valores */}
          {pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3" fill={color} />
              {p.v > 0 && (
                <text
                  x={p.x}
                  y={p.y - 7}
                  textAnchor="middle"
                  fontSize="8"
                  fill={color}
                  fontWeight="600"
                  opacity="0.9"
                >
                  {p.v}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* X-axis labels */}
        <div className="flex justify-between mt-1.5 px-0.5">
          {labels.map((label, i) => (
            <span
              key={i}
              className="text-[10px] text-gray-400 dark:text-white/30 text-center capitalize"
              style={{ width: `${100 / bars}%` }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
