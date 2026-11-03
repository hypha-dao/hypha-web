'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  DEFAULT_SIGNAL_SORT,
  DEFAULT_SIGNAL_TIME_FRAME,
  parseSignalSort,
  parseSignalTimeFrame,
  rankSignals,
  useFindCoherences,
  useSpaceBySlug,
  type SignalSort,
  type SignalTimeFrame,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, ErrorAlert, Skeleton } from '@hypha-platform/ui';
import { CoherenceOrder } from '../types';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { getSignalPath } from '../../common/get-path-function';
import { signalSpaceMembership } from '../hooks/use-is-signal-space-non-member';
import { useSignalProvisioningNotice } from '../hooks/use-signal-provisioning-notice';
import { useSignalRoomActivity } from '../hooks/use-signal-room-activity';
import {
  signalVotingSpaceId,
  useSignalVotingMode,
} from '../hooks/use-signal-voting-mode';
import { SignalFeedFilters } from './signal-feed-filters';
import { SignalFeedRow } from './signal-feed-row';
import type { UseMembers } from '../../spaces/hooks/types';

export const SIGNAL_SORT_QUERY_KEY = 'sort';
export const SIGNAL_TIME_FRAME_QUERY_KEY = 't';
/** Earlier `?top=7d|30d|all` links still open on the matching time frame. */
const LEGACY_TOP_WINDOW_QUERY_KEY = 'top';
const ARCHIVED_QUERY_KEY = 'archived';

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
  const {
    canMutate,
    isLoading: isMembershipLoading,
    userState,
  } = useCanMutateInSpace({
    spaceSlug,
    spaceId: space?.web3SpaceId ?? undefined,
  });
  const { isNonMember, isMembershipPending } = signalSpaceMembership({
    space,
    isLoading: isMembershipLoading,
    userState,
  });
  const {
    votingMode,
    status: votingModeStatus,
    retry: retryVotingMode,
  } = useSignalVotingMode(signalVotingSpaceId(space));
  const provisioningNoticeLines = useSignalProvisioningNotice();

  const sort = parseSignalSort(searchParams.get(SIGNAL_SORT_QUERY_KEY));
  const timeFrame = parseSignalTimeFrame(
    searchParams.get(SIGNAL_TIME_FRAME_QUERY_KEY) ??
      searchParams.get(LEGACY_TOP_WINDOW_QUERY_KEY),
  );
  React.useEffect(() => {
    if (!searchParams.has(ARCHIVED_QUERY_KEY)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete(ARCHIVED_QUERY_KEY);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  const replaceQuery = React.useCallback(
    (key: string, value: string, defaultValue: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const legacyTop = params.get(LEGACY_TOP_WINDOW_QUERY_KEY);
      if (legacyTop != null) {
        params.delete(LEGACY_TOP_WINDOW_QUERY_KEY);
        const legacyTimeFrame = parseSignalTimeFrame(legacyTop);
        if (
          !params.has(SIGNAL_TIME_FRAME_QUERY_KEY) &&
          legacyTimeFrame !== DEFAULT_SIGNAL_TIME_FRAME
        ) {
          params.set(SIGNAL_TIME_FRAME_QUERY_KEY, legacyTimeFrame);
        }
      }
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
      replaceQuery(SIGNAL_SORT_QUERY_KEY, next, DEFAULT_SIGNAL_SORT),
    [replaceQuery],
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
    isPreviousData: isPreviousSignals,
    error: signalsError,
    refresh,
  } = useFindCoherences({
    spaceSlug,
    orderBy: 'mostupvoted',
  });

  const [isRetrying, setIsRetrying] = React.useState(false);
  const retryLoad = React.useCallback(async () => {
    setIsRetrying(true);
    try {
      await refresh();
    } catch {
      // The SWR error state already drives the retry notice.
    } finally {
      setIsRetrying(false);
    }
  }, [refresh]);

  const ranked = React.useMemo(
    () => rankSignals(signals ?? [], { sort, timeFrame }),
    [signals, sort, timeFrame],
  );
  const activity = useSignalRoomActivity(ranked);
  const hasSignals = Boolean(signals?.length);
  const hasCurrentQuerySignals = hasSignals && !isPreviousSignals;
  const isLoading = isSpaceLoading || (isSignalsLoading && !hasSignals);
  // Same-query refresh errors keep the list; a failed new query must not hide behind the old one.
  const loadFailed =
    signalsError != null && !hasCurrentQuerySignals && !isSignalsLoading;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="craft-page-title text-6 font-medium">
          {t('signals')}
          {typeof signals?.length === 'number' && !loadFailed ? (
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
              {t('createQuest')}
            </Link>
          </Button>
        ) : null}
      </header>

      <ErrorAlert lines={provisioningNoticeLines} bgColor="bg-yellow-600" />

      <SignalFeedFilters
        sort={sort}
        timeFrame={timeFrame}
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
      ) : loadFailed ? (
        <div
          role="alert"
          className="craft-card flex flex-col items-center gap-3 px-4 py-8 text-center"
        >
          <p className="m-0 text-1 text-muted-foreground">
            {t('signalLoadFailed')}
          </p>
          <Button
            type="button"
            variant="outline"
            colorVariant="neutral"
            size="sm"
            disabled={isRetrying}
            onClick={() => void retryLoad()}
          >
            {t('signalLoadRetry')}
          </Button>
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
                votingModeStatus={votingModeStatus}
                onRetryVotingMode={retryVotingMode}
                isNonMember={isNonMember}
                isMembershipPending={isMembershipPending}
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
