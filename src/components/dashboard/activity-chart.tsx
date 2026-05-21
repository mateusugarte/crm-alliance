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
  const endColor = colorEnd ?? color

  const VW = 320
  const PAD_TOP = 6
  const PAD_LEFT = 2
  const PAD_RIGHT = 2
  const CHART_H = 64
  const LABEL_H = 16
  const VH = PAD_TOP + CHART_H + LABEL_H

  const usableW = VW - PAD_LEFT - PAD_RIGHT
  const step = usableW / n
  const padX = step / 2

  const pts = data.map((v, i) => ({
    x: PAD_LEFT + padX + i * step,
    y: PAD_TOP + CHART_H - Math.max((v / max) * (CHART_H - 6), v > 0 ? 5 : 0),
    v,
    label: labels[i] ?? '',
  }))

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
  const last = pts[pts.length - 1]!
  const areaPath = `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`

  const total = data.reduce((a, b) => a + b, 0)
  const slug = title.replace(/[^a-z0-9]/gi, '-')
  const gradFill = `gf-${slug}`
  const gradStroke = `gs-${slug}`

  // Show dots only for small datasets
  const showDots = n <= 10

  return (
    <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.06] overflow-hidden">
      {/* Thin accent bar */}
      <div
        className="h-[2px] w-full"
        style={{ background: `linear-gradient(90deg, ${color}, ${endColor})` }}
      />

      <div className="px-4 pt-3 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-white/35 uppercase tracking-widest">
              {title}
            </p>
            {subtitle && (
              <p className="text-[10px] text-gray-300 dark:text-white/20 mt-0.5">{subtitle}</p>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="text-xl font-bold tabular-nums leading-none"
              style={{ color }}
            >
              {total}
            </span>
            <span className="text-[10px] text-gray-400 dark:text-white/25 font-medium">
              total
            </span>
          </div>
        </div>

        {/* Chart */}
        <svg
          viewBox={`0 0 ${VW} ${VH}`}
          preserveAspectRatio="xMidYMid meet"
          width="100%"
          aria-hidden="true"
          style={{ display: 'block' }}
        >
          <defs>
            <linearGradient id={gradFill} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
            <linearGradient id={gradStroke} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={endColor} />
            </linearGradient>
          </defs>

          {/* Single baseline */}
          <line
            x1={PAD_LEFT}
            y1={baseY}
            x2={VW - PAD_RIGHT}
            y2={baseY}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="1"
          />

          {/* Area fill */}
          <path d={areaPath} fill={`url(#${gradFill})`} />

          {/* Main line */}
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${gradStroke})`}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Dots — only for small datasets */}
          {showDots && pts.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="2.5" fill={color} />
              <circle cx={p.x} cy={p.y} r="1" fill="white" opacity="0.85" />
            </g>
          ))}

          {/* X-axis labels */}
          {pts.map((p, i) => {
            // For many data points, only show every N labels to avoid clutter
            const skip = n > 14 ? 4 : n > 7 ? 2 : 1
            if (i % skip !== 0 && i !== n - 1) return null
            return (
              <text
                key={i}
                x={p.x}
                y={VH - 1}
                textAnchor="middle"
                fontSize="8.5"
                fontWeight="500"
                fill="currentColor"
                opacity="0.28"
                style={{ textTransform: 'capitalize' }}
              >
                {p.label}
              </text>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
