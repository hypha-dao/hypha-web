'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  DEFAULT_SIGNAL_TIME_FRAME,
  defaultSignalSort,
  parseSignalSort,
  parseSignalTimeFrame,
  rankSignals,
  useFindCoherences,
  useSpaceBySlug,
  type SignalSort,
  type SignalTimeFrame,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, Skeleton } from '@hypha-platform/ui';
import { CoherenceOrder } from '../types';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { getSignalPath } from '../../common/get-path-function';
import { useSignalRoomActivity } from '../hooks/use-signal-room-activity';
import { useSignalVotingMode } from '../hooks/use-signal-voting-mode';
import { SignalFeedFilters } from './signal-feed-filters';
import { SignalFeedRow } from './signal-feed-row';
import type { UseMembers } from '../../spaces/hooks/types';

export const SIGNAL_SORT_QUERY_KEY = 'sort';
export const SIGNAL_TIME_FRAME_QUERY_KEY = 't';
/** Earlier `?top=7d|30d|all` links still open on the matching time frame. */
const LEGACY_TOP_WINDOW_QUERY_KEY = 'top';

export type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
  /** Kept for route compatibility; the feed always ranks by upvotes. */
  order?: CoherenceOrder;
  humanChatEnabled?: boolean;
  useMembers?: UseMembers;
};

export function CoherenceBlock({ lang, spaceSlug }: CoherenceBlockProps) {
  const t = useTranslations('CoherenceTab');
  const format = useFormatter();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { space, isLoading: isSpaceLoading } = useSpaceBySlug(spaceSlug);
  const { canMutate } = useCanMutateInSpace({
    spaceSlug,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const {
    votingMode,
    hasError: votingModeError,
    retry: retryVotingMode,
  } = useSignalVotingMode(space?.web3SpaceId);

  const sort = parseSignalSort(
    searchParams.get(SIGNAL_SORT_QUERY_KEY),
    votingMode,
  );
  const timeFrame = parseSignalTimeFrame(
    searchParams.get(SIGNAL_TIME_FRAME_QUERY_KEY) ??
      searchParams.get(LEGACY_TOP_WINDOW_QUERY_KEY),
  );

  const replaceQuery = React.useCallback(
    (key: string, value: string, defaultValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(LEGACY_TOP_WINDOW_QUERY_KEY);
      if (value === defaultValue) params.delete(key);
      else params.set(key, value);
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );
  const handleSortChange = React.useCallback(
    (next: SignalSort) =>
      replaceQuery(SIGNAL_SORT_QUERY_KEY, next, defaultSignalSort(votingMode)),
    [replaceQuery, votingMode],
  );
  const handleTimeFrameChange = React.useCallback(
    (next: SignalTimeFrame) =>
      replaceQuery(
        SIGNAL_TIME_FRAME_QUERY_KEY,
        next,
        DEFAULT_SIGNAL_TIME_FRAME,
      ),
    [replaceQuery],
  );

  const {
    coherences: signals,
    isLoading: isSignalsLoading,
    refresh,
  } = useFindCoherences({ spaceSlug, orderBy: 'mostupvoted' });

  const ranked = React.useMemo(
    () => rankSignals(signals ?? [], { sort, timeFrame }),
    [signals, sort, timeFrame],
  );
  const activity = useSignalRoomActivity(ranked);
  const isLoading = isSpaceLoading || (isSignalsLoading && !signals?.length);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="craft-page-title text-6 font-medium">
          {t('signals')}
          {typeof signals?.length === 'number' ? (
            <span className="ml-2 text-4 font-normal text-muted-foreground">
              | {format.number(signals.length)}
            </span>
          ) : null}
        </h1>
        {canMutate ? (
          <Button asChild colorVariant="neutral" className="gap-1.5">
            <Link
              href={`/${lang}/dho/${spaceSlug}/coherence/new-signal`}
              scroll={false}
            >
              <Plus className="craft-icon" aria-hidden />
              {t('newSignal')}
            </Link>
          </Button>
        ) : null}
      </header>

      <SignalFeedFilters
        sort={sort}
        timeFrame={timeFrame}
        votingMode={votingMode}
        onSortChange={handleSortChange}
        onTimeFrameChange={handleTimeFrameChange}
        className="-ml-3.5"
      />

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              loading
              className="h-[104px] w-full rounded-none"
            />
          ))}
        </div>
      ) : ranked.length === 0 ? (
        <p className="craft-card px-4 py-8 text-center text-1 text-muted-foreground">
          {t('listIsEmpty')}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {ranked.map((signal) =>
            signal.slug ? (
              <SignalFeedRow
                key={signal.id}
                signal={signal}
                href={getSignalPath(lang, spaceSlug, signal.slug)}
                votingMode={votingMode}
                votingModeError={votingModeError}
                onRetryVotingMode={retryVotingMode}
                activity={signal.roomId ? activity[signal.roomId] : undefined}
                refresh={refresh}
              />
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
