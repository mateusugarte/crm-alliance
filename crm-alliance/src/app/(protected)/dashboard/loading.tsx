import { MetricsGridSkeleton, ChartsSkeleton } from '@/components/dashboard/metrics-grid-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="px-8 py-7 flex flex-col gap-7">
      {/* Greeting skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-8 w-64 rounded-xl" />
      </div>
      <MetricsGridSkeleton />
      <ChartsSkeleton />
    </div>
  )
}
