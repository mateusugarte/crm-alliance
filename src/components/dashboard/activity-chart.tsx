interface ActivityChartProps {
  title: string
  labels: string[]
  data: number[]
  color?: string
}

export function ActivityChart({ title, labels, data, color = '#1E90FF' }: ActivityChartProps) {
  const max = Math.max(...data, 1)
  const n = data.length
  // Coordenadas internas do SVG — labels ficam aqui dentro (sem desalinhamento)
  const VW = 300
  const CHART_H = 88
  const LABEL_H = 18
  const VH = CHART_H + LABEL_H
  const step = VW / n
  const padX = step / 2

  const pts = data.map((v, i) => ({
    x: padX + i * step,
    y: CHART_H - Math.max((v / max) * (CHART_H - 14), v > 0 ? 5 : 0),
    v,
    label: labels[i] ?? '',
  }))

  // Curva bezier suave
  const linePath = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = pts[i - 1]
      const cpX = (p.x + prev.x) / 2
      return `C ${cpX} ${prev.y} ${cpX} ${p.y} ${p.x} ${p.y}`
    })
    .join(' ')

  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${CHART_H} L ${pts[0].x} ${CHART_H} Z`
  const total = data.reduce((a, b) => a + b, 0)
  // ID único por título evita colisão de gradientes entre os dois gráficos
  const gradId = `grad-${title.replace(/[^a-z0-9]/gi, '-')}`

  return (
    <div className="bg-white dark:bg-white/5 rounded-2xl px-5 py-5 border border-gray-100 dark:border-white/8">
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-400 dark:text-white/40 uppercase tracking-widest">
          {title}
        </h3>
        <span className="text-xs font-bold tabular-nums" style={{ color }}>
          {total}
        </span>
      </div>

      {/* viewBox inclui área de labels — sem elementos HTML externos = sem desalinhamento */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Área preenchida */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Linha */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos, rótulos de valor e labels do eixo X — todos alinhados ao mesmo x */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3" fill={color} />

            {p.v > 0 && (
              <text
                x={p.x}
                y={p.y - 7}
                textAnchor="middle"
                fontSize="8.5"
                fill={color}
                fontWeight="700"
                opacity="0.9"
              >
                {p.v}
              </text>
            )}

            {/* Label eixo X — sempre alinhado ao ponto */}
            <text
              x={p.x}
              y={VH - 2}
              textAnchor="middle"
              fontSize="9"
              fontWeight="500"
              fill="currentColor"
              opacity="0.35"
              style={{ textTransform: 'capitalize' }}
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
