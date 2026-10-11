import { NetworkLoadingGrid } from '@hypha-platform/epics';

export function NetworkIndexFallback() {
  return (
    <div className="flex min-w-0 flex-col" aria-busy="true">
      <div className="mb-6 h-10 w-full animate-pulse rounded-md border border-neutral-4 bg-neutral-2" />
      <NetworkLoadingGrid
        count={12}
        cardGridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
      />
    </div>
  );
}
