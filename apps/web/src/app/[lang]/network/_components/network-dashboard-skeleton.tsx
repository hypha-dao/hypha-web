import { Card, CardContent, Skeleton } from '@hypha-platform/ui';

function KpiSkeleton() {
  return (
    <Card className="craft-card">
      <CardContent className="flex flex-col gap-3 p-3.5">
        <Skeleton loading width={72} height={12} />
        <Skeleton loading width={64} height={32} />
        <Skeleton loading width={88} height={12} />
      </CardContent>
    </Card>
  );
}

export function NetworkDashboardSkeleton() {
  return (
    <div
      data-testid="network-dashboard-skeleton"
      className="flex min-w-0 flex-col gap-4"
      aria-hidden="true"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <KpiSkeleton key={index} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="craft-card lg:col-span-2">
          <CardContent className="p-3.5">
            <Skeleton loading width={160} height={16} className="mb-4" />
            <Skeleton loading width="100%" height={176} />
          </CardContent>
        </Card>
        <Card className="craft-card">
          <CardContent className="p-3.5">
            <Skeleton loading width={120} height={16} className="mb-4" />
            <Skeleton loading width="100%" height={80} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
