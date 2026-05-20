interface ActivityChartProps {
  title: string
  subtitle?: string
  labels: string[]
  data: number[]
  color?: string
  colorEnd?: string
}

export function ActivityChart({
  title,
  subtitle,
  labels,
  data,
  color = '#1E90FF',
  colorEnd,
}: ActivityChartProps) {
  const max = Math.max(...data, 1)
  const n = data.length

  const VW = 340
  const PAD_TOP = 20
  const PAD_LEFT = 6
  const PAD_RIGHT = 6
  const CHART_H = 96
  const LABEL_H = 20
  const VH = PAD_TOP + CHART_H + LABEL_H

  const usableW = VW - PAD_LEFT - PAD_RIGHT
  const step = usableW / n
  const padX = step / 2

  const pts = data.map((v, i) => ({
    x: PAD_LEFT + padX + i * step,
    y: PAD_TOP + CHART_H - Math.max((v / max) * (CHART_H - 12), v > 0 ? 8 : 0),
    v,
    label: labels[i] ?? '',
  }))

  // Horizontal grid at 33%, 66%
  const gridYs = [0.33, 0.66].map(ratio =>
    PAD_TOP + CHART_H - ratio * (CHART_H - 12)
  )

  const linePath = pts
    .map((p, i) => {
      if (i === 0) return `M ${p.x} ${p.y}`
      const prev = pts[i - 1]!
      const cpX = (p.x + prev.x) / 2
      return `C ${cpX} ${prev.y} ${cpX} ${p.y} ${p.x} ${p.y}`
    })
    .join(' ')

  const baseY = PAD_TOP + CHART_H
  const first = pts[0]!
  const last  = pts[pts.length - 1]!
  const areaPath = `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`

  const total = data.reduce((a, b) => a + b, 0)
  const slug  = title.replace(/[^a-z0-9]/gi, '-')
  const gradFill  = `gf-${slug}`
  const gradStroke = `gs-${slug}`

  const endColor = colorEnd ?? color

  return (
    <div
      className="bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/8 overflow-hidden"
      style={{ boxShadow: '0 2px 16px 0 rgb(0 0 0 / 0.06)' }}
    >
      {/* Accent top bar */}
      <div className="h-[3px] w-full" style={{ background: `linear-gradient(90deg, ${color}, ${endColor})` }} />

      <div className="px-5 pt-4 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-white/40 uppercase tracking-widest">
              {title}
            </h3>
            {subtitle && (
              <p className="text-[11px] text-gray-400 dark:text-white/25 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="text-right">
            <span
              className="text-2xl font-bold tabular-nums leading-none block"
              style={{ color }}
            >
              {total}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-white/30 font-medium">
              no período
            </span>
          </div>
        </div>

        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          aria-hidden="true"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={gradFill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color}    stopOpacity="0.28" />
              <stop offset="100%" stopColor={color}    stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id={gradStroke} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={color} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridYs.map((gy, i) => (
            <line
              key={i}
              x1={PAD_LEFT}
              y1={gy}
              x2={VW - PAD_RIGHT}
              y2={gy}
              stroke="currentColor"
              strokeOpacity="0.07"
              strokeWidth="1"
              strokeDasharray="5 4"
            />
          ))}

          {/* Baseline */}
          <line
            x1={PAD_LEFT}
            y1={baseY}
            x2={VW - PAD_RIGHT}
            y2={baseY}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="1"
          />

          {/* Filled area */}
          <path d={areaPath} fill={`url(#${gradFill})`} />

          {/* Glow line (thick, low opacity) */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.1"
          />

          {/* Main line */}
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${gradStroke})`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots + value labels + axis labels */}
          {pts.map((p, i) => (
            <g key={i}>
              {/* Halo */}
              <circle cx={p.x} cy={p.y} r="6"   fill={color} opacity="0.1" />
              {/* Outer dot */}
              <circle cx={p.x} cy={p.y} r="3.5" fill={color} />
              {/* White core */}
              <circle cx={p.x} cy={p.y} r="1.5" fill="white" opacity="0.9" />

              {/* Value label above dot */}
              {p.v > 0 && (
                <text
                  x={p.x}
                  y={p.y - 11}
                  textAnchor="middle"
                  fontSize="9"
                  fill={color}
                  fontWeight="700"
                >
                  {p.v}
                </text>
              )}

              {/* X-axis label */}
              <text
                x={p.x}
                y={VH - 2}
                textAnchor="middle"
                fontSize="9"
                fontWeight="500"
                fill="currentColor"
                opacity="0.38"
                style={{ textTransform: 'capitalize' }}
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}
