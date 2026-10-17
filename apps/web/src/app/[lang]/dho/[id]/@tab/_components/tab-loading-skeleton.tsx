import { cn } from '@hypha-platform/ui-utils';

type TabLoadingLayout =
  | 'overview'
  | 'members'
  | 'agreements'
  | 'coherence'
  | 'treasury'
  | 'rows';

type TabLoadingSkeletonProps = {
  layout?: TabLoadingLayout;
  showTitle?: boolean;
};

function Pulse({
  className,
  delayMs = 0,
}: {
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      className={cn('animate-pulse rounded-none bg-foreground/10', className)}
      style={delayMs ? { animationDelay: `${delayMs}ms` } : undefined}
      aria-hidden
    />
  );
}

function Title({ show }: { show: boolean }) {
  if (!show) return null;
  return <Pulse className="h-7 w-44" />;
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2 border-t-2 border-foreground/15 pt-3">
        <Pulse className="h-8 w-72 max-w-full" />
        <Pulse className="h-3 w-48" delayMs={40} />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <Pulse
            key={index}
            className="h-8 w-8 rounded-full"
            delayMs={index * 50}
          />
        ))}
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]">
        <div>
          <Pulse className="h-4 w-24" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Pulse className="h-28 w-full" delayMs={60} />
            <Pulse className="h-28 w-full" delayMs={120} />
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <Pulse className="h-4 w-28" />
          <Pulse className="h-16 w-full" delayMs={80} />
          <Pulse className="h-24 w-full" delayMs={140} />
        </div>
      </div>
      <div className="flex gap-6 overflow-hidden">
        {Array.from({ length: 2 }, (_, map) => (
          <div key={map} className="w-52 shrink-0">
            <Pulse className="h-3 w-20" delayMs={map * 80} />
            <div className="mt-3 grid grid-cols-4 gap-1">
              {Array.from({ length: 16 }, (__, cell) => (
                <Pulse
                  key={cell}
                  className="aspect-square w-full"
                  delayMs={map * 80 + cell * 20}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MembersSkeleton({ showTitle }: { showTitle: boolean }) {
  return (
    <div className="flex flex-col gap-4 py-4" aria-hidden>
      <Title show={showTitle} />
      <div className="flex gap-2">
        <Pulse className="h-8 w-24" />
        <Pulse className="h-8 w-20" delayMs={40} />
        <Pulse className="h-8 w-16" delayMs={80} />
      </div>
      <Pulse className="h-10 w-full" delayMs={60} />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="flex items-start gap-2.5 border border-border p-3"
          >
            <Pulse
              className="h-10 w-10 shrink-0 rounded-full"
              delayMs={index * 50}
            />
            <div className="grid min-w-0 flex-1 gap-2 pt-1">
              <Pulse className="h-3 w-2/3" delayMs={index * 50 + 30} />
              <Pulse className="h-3 w-1/3" delayMs={index * 50 + 60} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgreementsSkeleton({ showTitle }: { showTitle: boolean }) {
  return (
    <div className="flex flex-col gap-4 py-4" aria-hidden>
      <Title show={showTitle} />
      <Pulse className="h-10 w-full" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex items-center gap-3 border border-border px-3 py-3"
          >
            <Pulse className="h-10 w-16 shrink-0" delayMs={index * 60} />
            <div className="grid min-w-0 flex-1 gap-2">
              <Pulse className="h-3 w-1/2" delayMs={index * 60 + 30} />
              <Pulse className="h-3 w-1/3" delayMs={index * 60 + 60} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoherenceSkeleton() {
  return (
    <div className="flex w-full overflow-hidden py-4" aria-hidden>
      {Array.from({ length: 4 }, (_, column) => (
        <div
          key={column}
          className="flex min-w-0 flex-1 flex-col gap-2 border-r border-border/50 p-2 last:border-r-0"
        >
          <Pulse className="h-6 w-24" delayMs={column * 80} />
          {Array.from({ length: 3 }, (__, card) => (
            <div key={card} className="border border-border/50 p-3">
              <Pulse className="h-3 w-3/4" delayMs={column * 80 + card * 40} />
              <Pulse
                className="mt-2 h-3 w-1/2"
                delayMs={column * 80 + card * 40 + 30}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function TreasurySkeleton({ showTitle }: { showTitle: boolean }) {
  return (
    <div className="flex flex-col gap-4 py-4" aria-hidden>
      <Title show={showTitle} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="border border-border p-3">
            <Pulse className="h-3 w-16" delayMs={index * 40} />
            <Pulse className="mt-3 h-6 w-20" delayMs={index * 40 + 40} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 py-2">
            <Pulse
              className="h-8 w-8 shrink-0 rounded-full"
              delayMs={index * 50}
            />
            <Pulse className="h-3 w-24" delayMs={index * 50 + 20} />
            <Pulse className="ml-auto h-3 w-16" delayMs={index * 50 + 40} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RowsSkeleton({ showTitle }: { showTitle: boolean }) {
  return (
    <div className="flex flex-col gap-3 py-4" aria-hidden>
      <Title show={showTitle} />
      {Array.from({ length: 6 }, (_, index) => (
        <Pulse key={index} className="h-12 w-full" delayMs={index * 50} />
      ))}
    </div>
  );
}

/**
 * Suspense fallback for space-detail tabs. Each layout follows that tab's
 * loaded shape so the pulse does not invent a card grid the page does not use.
 */
export function TabLoadingSkeleton({
  layout = 'rows',
  showTitle = true,
}: TabLoadingSkeletonProps) {
  return (
    <div data-tab-loading="">
      {layout === 'overview' ? (
        <OverviewSkeleton />
      ) : layout === 'members' ? (
        <MembersSkeleton showTitle={showTitle} />
      ) : layout === 'agreements' ? (
        <AgreementsSkeleton showTitle={showTitle} />
      ) : layout === 'coherence' ? (
        <CoherenceSkeleton />
      ) : layout === 'treasury' ? (
        <TreasurySkeleton showTitle={showTitle} />
      ) : (
        <RowsSkeleton showTitle={showTitle} />
      )}
    </div>
  );
}
