import { Skeleton } from '@hypha-platform/ui';

type TabLoadingSkeletonProps = {
  cards?: number;
  showTitle?: boolean;
};

/**
 * Shared Suspense fallback for the space-detail `@tab` slots. Rendering a
 * skeleton via each tab's `loading.tsx` gives instant visual feedback on tab
 * switch instead of leaving the previous tab's content frozen until the RSC
 * resolves.
 */
export function TabLoadingSkeleton({
  cards = 6,
  showTitle = true,
}: TabLoadingSkeletonProps) {
  return (
    <div className="flex flex-col gap-4 py-4">
      {showTitle ? (
        <div className="flex flex-col gap-3">
          <Skeleton loading width={180} height={28} className="rounded-md" />
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <Skeleton
            key={index}
            loading
            height={140}
            className="w-full rounded-lg"
          />
        ))}
      </div>
    </div>
  );
}
