import { MetricsGridSkeleton } from '@/components/dashboard/metrics-grid-skeleton'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-10 w-72 rounded-xl" />
      <MetricsGridSkeleton />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  )
}
