import { Skeleton } from '@/components/ui/skeleton'
import { CHART_SKELETON_HEIGHTS } from '@/lib/tokens'

export function MetricsGridSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-2xl" />
      ))}
    </div>
  )
}

export function ChartsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl px-6 py-5 shadow-card">
          <Skeleton className="h-4 w-48 rounded mb-4" />
          <div className="flex items-end gap-2 h-32">
            {CHART_SKELETON_HEIGHTS.map((height, j) => (
              <Skeleton
                key={j}
                className="flex-1 rounded-md"
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
