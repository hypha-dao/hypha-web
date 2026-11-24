import { Wave } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

type TabLoadingLayout =
  | 'overview'
  | 'member-home'
  | 'members'
  | 'agreements'
  | 'coherence'
  | 'signal-detail'
  | 'member-signal-detail'
  | 'treasury'
  | 'rows';

/** Matches MemberSpaceHome card width (lovable: (100% - 24px) / 2.2). */
const MEMBER_HOME_CARD_WIDTH =
  'w-[min(100%,calc((100%-24px)/2.2))] max-md:w-[82%] min-w-[240px]';

type TabLoadingSkeletonProps = {
  layout?: TabLoadingLayout;
  showTitle?: boolean;
};

function Pulse({
  className,
  delayMs = 0,
  text,
}: {
  className?: string;
  delayMs?: number;
  text?: boolean;
}) {
  return (
    <Wave
      text={text}
      className={cn('rounded-none', className)}
      delayMs={delayMs}
    />
  );
}

function Title({ show }: { show: boolean }) {
  if (!show) return null;
  return <Pulse text className="h-7 w-44" />;
}

function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      <div className="flex flex-col gap-2 border-t-2 border-foreground/15 pt-3">
        <Pulse text className="h-8 w-72 max-w-full" />
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

function MemberHomeCardSkeleton({
  delayMs = 0,
  className,
}: {
  delayMs?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        `flex min-w-0 ${MEMBER_HOME_CARD_WIDTH} shrink-0 flex-col border border-border bg-transparent p-3`,
        className,
      )}
    >
      <Pulse className="mb-2.5 aspect-video w-full" delayMs={delayMs} />
      <div className="flex flex-1 flex-col gap-2">
        <Pulse className="h-2.5 w-16" delayMs={delayMs + 30} />
        <Pulse className="h-5 w-4/5" delayMs={delayMs + 50} />
        <Pulse className="h-3 w-full" delayMs={delayMs + 70} />
        <Pulse className="h-3 w-5/6" delayMs={delayMs + 90} />
        <div className="mt-auto flex items-center gap-2.5 border-t border-border pt-4">
          <Pulse className="h-[36px] w-24" delayMs={delayMs + 110} />
          <Pulse className="h-[34px] w-16" delayMs={delayMs + 130} />
        </div>
      </div>
    </div>
  );
}

/** Same shape as MemberSpaceHome: title row, signal strip, ask panel. */
function MemberHomeSkeleton() {
  return (
    <div
      className="flex w-full min-w-0 flex-col gap-2 py-4"
      aria-hidden
      data-member-home-skeleton=""
    >
      <section className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <Pulse text className="h-3 w-28" />
            <Pulse className="h-3 w-28" delayMs={40} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Pulse text className="h-8 w-56 max-w-full sm:h-9 sm:w-72" />
            <div className="hidden items-center gap-1.5 md:flex">
              <Pulse className="h-[36px] w-[36px]" delayMs={60} />
              <Pulse className="h-[36px] w-[36px]" delayMs={80} />
            </div>
          </div>
        </div>
        <div className="flex snap-x items-stretch gap-5 overflow-hidden">
          <MemberHomeCardSkeleton />
          <MemberHomeCardSkeleton className="hidden md:flex" delayMs={80} />
          <MemberHomeCardSkeleton className="hidden lg:flex" delayMs={160} />
        </div>
      </section>
      <section className="min-w-0">
        <Pulse
          className="h-[28rem] w-full border border-border"
          delayMs={120}
        />
      </section>
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
      <div className="@container/members w-full">
        <div className="grid w-full grid-cols-1 gap-3 @min-[40rem]/members:grid-cols-2 @min-[62rem]/members:grid-cols-3">
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

/** Same shape as member SignalPage detail: back, type, title, byline, tags, actions, body. */
function MemberSignalDetailSkeleton() {
  return (
    <div
      className="flex w-full min-w-0 flex-col gap-6 py-2"
      aria-hidden
      data-member-signal-detail-skeleton=""
    >
      <Pulse className="h-4 w-20" />
      <div className="flex min-w-0 flex-col gap-5">
        <header className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Pulse className="h-6 w-20" delayMs={40} />
            <Pulse className="h-4 w-12" delayMs={60} />
          </div>
          <Pulse text className="h-8 w-full max-w-xl" delayMs={80} />
          <div className="flex items-center gap-2">
            <Pulse className="size-6 shrink-0 rounded-full" delayMs={100} />
            <Pulse className="h-3.5 w-48" delayMs={120} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Pulse className="h-6 w-24" delayMs={140} />
            <Pulse className="h-6 w-20" delayMs={160} />
            <Pulse className="h-6 w-16" delayMs={180} />
          </div>
        </header>
        <div className="flex flex-wrap items-center gap-2">
          <Pulse className="h-9 w-24" delayMs={200} />
          <Pulse className="h-9 w-36" delayMs={220} />
        </div>
        <div className="flex flex-col gap-2">
          <Pulse className="h-3.5 w-full" delayMs={240} />
          <Pulse className="h-3.5 w-11/12" delayMs={260} />
          <Pulse className="h-3.5 w-4/5" delayMs={280} />
          <Pulse className="h-3.5 w-2/3" delayMs={300} />
        </div>
      </div>
    </div>
  );
}

/** Builder/funder signal detail: back + title card + body blocks. */
function SignalDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4" aria-hidden>
      <Pulse className="h-4 w-28" />
      <div className="flex flex-col gap-3 border border-border p-4">
        <Pulse className="h-5 w-16" delayMs={40} />
        <Pulse text className="h-7 w-3/4 max-w-lg" delayMs={80} />
        <Pulse className="h-3.5 w-56" delayMs={120} />
      </div>
      <Pulse className="h-32 w-full" delayMs={160} />
      <Pulse className="h-24 w-full" delayMs={200} />
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
      ) : layout === 'member-home' ? (
        <MemberHomeSkeleton />
      ) : layout === 'members' ? (
        <MembersSkeleton showTitle={showTitle} />
      ) : layout === 'agreements' ? (
        <AgreementsSkeleton showTitle={showTitle} />
      ) : layout === 'coherence' ? (
        <CoherenceSkeleton />
      ) : layout === 'member-signal-detail' ? (
        <MemberSignalDetailSkeleton />
      ) : layout === 'signal-detail' ? (
        <SignalDetailSkeleton />
      ) : layout === 'treasury' ? (
        <TreasurySkeleton showTitle={showTitle} />
      ) : (
        <RowsSkeleton showTitle={showTitle} />
      )}
    </div>
  );
}
