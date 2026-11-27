'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  DEFAULT_SIGNAL_SORT,
  DEFAULT_SIGNAL_TIME_FRAME,
  filterSignalsByTitle,
  parseSignalSort,
  parseSignalTimeFrame,
  rankSignals,
  signalListUpvoteSummaryState,
  useFindCoherences,
  useSignalWorkflow,
  useSpaceBySlug,
  type Coherence,
  type SignalSort,
  type SignalTimeFrame,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, ErrorAlert, Skeleton } from '@hypha-platform/ui';
import { CoherenceOrder } from '../types';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { getSignalPath } from '../../common/get-path-function';
import { ActionGate } from '../../common/action-capabilities';
import { signalSpaceMembership } from '../hooks/use-is-signal-space-non-member';
import { useSignalProvisioningNotice } from '../hooks/use-signal-provisioning-notice';
import { useSignalRoomActivity } from '../hooks/use-signal-room-activity';
import {
  signalVotingSpaceId,
  useSignalVotingMode,
} from '../hooks/use-signal-voting-mode';
import { SignalFeedFilters } from './signal-feed-filters';
import { SignalFeedRow } from './signal-feed-row';
import { signalBoardLabel } from '../lib/signal-board-label';
import {
  DEFAULT_SIGNAL_LANE_COLUMNS,
  DEFAULT_SIGNAL_TAB_VIEW,
  SIGNAL_LANE_COLUMNS_QUERY_KEY,
  SIGNAL_TAB_VIEW_QUERY_KEY,
  groupSignalsIntoLanes,
  isSignalBoardMove,
  parseSignalLaneColumns,
  parseSignalTabView,
  readStoredSignalTabView,
  writeStoredSignalTabView,
  type SignalLaneColumns,
  type SignalTabView,
} from '../lib/signal-swimlanes';
import { SignalSwimlanes } from './signal-swimlanes';
import { SignalViewSwitch } from './signal-view-switch';
import { useMoveSignalToBoard } from '../hooks/use-move-signal-to-board';
import { useCanUpdateSignalTasks } from '../hooks/use-can-update-signal-tasks';
import { useDebouncedFeedTitle } from '../lib/use-debounced-feed-title';
import type { UseMembers } from '../../spaces/hooks/types';

export const SIGNAL_SORT_QUERY_KEY = 'sort';
export const SIGNAL_TIME_FRAME_QUERY_KEY = 't';
/** Title-only feed search. Distinct from the board's `title` query. */
export const SIGNAL_TITLE_QUERY_KEY = 'q';
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
  const { workflow } = useSignalWorkflow(spaceSlug);
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
  // URL first (shareable), then this browser's last choice for the space.
  const urlView = parseSignalTabView(
    searchParams.get(SIGNAL_TAB_VIEW_QUERY_KEY),
  );
  const [storedView, setStoredView] = React.useState<SignalTabView | null>(
    null,
  );
  React.useEffect(() => {
    setStoredView(readStoredSignalTabView(spaceSlug));
  }, [spaceSlug]);
  const view = urlView ?? storedView ?? DEFAULT_SIGNAL_TAB_VIEW;
  const laneColumns = parseSignalLaneColumns(
    searchParams.get(SIGNAL_LANE_COLUMNS_QUERY_KEY),
  );
  const handleViewChange = React.useCallback(
    (next: SignalTabView) => {
      writeStoredSignalTabView(spaceSlug, next);
      setStoredView(next);
      replaceQuery(SIGNAL_TAB_VIEW_QUERY_KEY, next, DEFAULT_SIGNAL_TAB_VIEW);
    },
    [replaceQuery, spaceSlug],
  );
  const handleLaneColumnsChange = React.useCallback(
    (next: SignalLaneColumns) =>
      replaceQuery(
        SIGNAL_LANE_COLUMNS_QUERY_KEY,
        next,
        DEFAULT_SIGNAL_LANE_COLUMNS,
      ),
    [replaceQuery],
  );
  const { canUpdateTasks } = useCanUpdateSignalTasks({
    spaceSlug,
    web3SpaceId: space?.web3SpaceId ?? undefined,
  });
  const moveSignalToBoard = useMoveSignalToBoard(spaceSlug);
  const handleMoveToBoard = React.useCallback(
    (signal: Coherence, board: string) => {
      if (!isSignalBoardMove(signal, board, workflow)) return;
      void moveSignalToBoard(signal, board);
    },
    [moveSignalToBoard, workflow],
  );

  const titleQuery = searchParams.get(SIGNAL_TITLE_QUERY_KEY) ?? '';
  const handleTitleCommit = React.useCallback(
    (next: string) => replaceQuery(SIGNAL_TITLE_QUERY_KEY, next, ''),
    [replaceQuery],
  );
  const { titleInput, onTitleChange } = useDebouncedFeedTitle({
    committed: titleQuery,
    onCommit: handleTitleCommit,
  });
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

  const ranked = React.useMemo(() => {
    // `useFindCoherences` already concatenates every page. Filter titles on
    // that full list, then rank, so sort and time frame apply to matches
    // past the first page. The API `search` param also matches descriptions.
    const matched = filterSignalsByTitle(signals ?? [], titleQuery);
    return rankSignals(matched, { sort, timeFrame });
  }, [signals, sort, timeFrame, titleQuery]);
  const activity = useSignalRoomActivity(ranked);
  const lanes = React.useMemo(
    () =>
      view === 'swimlanes'
        ? groupSignalsIntoLanes(ranked, workflow, laneColumns)
        : [],
    [laneColumns, ranked, view, workflow],
  );
  const upvoteSummaryState = signalListUpvoteSummaryState({
    hasSettledList: Boolean(signals),
    isLoading: isSignalsLoading,
    hasError: signalsError != null,
  });
  const hasSignals = Boolean(signals?.length);
  const hasCurrentQuerySignals = hasSignals && !isPreviousSignals;
  const isLoading = isSpaceLoading || (isSignalsLoading && !hasSignals);
  // Same-query refresh errors keep the list; a failed new query must not hide behind the old one.
  const loadFailed =
    signalsError != null && !hasCurrentQuerySignals && !isSignalsLoading;

  const renderSignal = (signal: Coherence) =>
    signal.slug ? (
      <SignalFeedRow
        signal={signal}
        spaceSlug={spaceSlug}
        href={getSignalPath(lang, spaceSlug, signal.slug)}
        votingMode={votingMode}
        votingModeStatus={votingModeStatus}
        onRetryVotingMode={retryVotingMode}
        isNonMember={isNonMember}
        isMembershipPending={isMembershipPending}
        activity={signal.roomId ? activity[signal.roomId] : undefined}
        refresh={refresh}
        sort={sort}
        summaryState={upvoteSummaryState}
        boardLabel={
          view === 'swimlanes' ? null : signalBoardLabel(signal.board, workflow)
        }
      />
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="craft-page-title text-6 font-medium">
          {t('signals')}
          {typeof signals?.length === 'number' && !loadFailed && !isLoading ? (
            <span className="ml-2 text-4 font-normal text-muted-foreground">
              | {format.number(ranked.length)}
            </span>
          ) : null}
        </h1>
      </header>

      <ErrorAlert lines={provisioningNoticeLines} bgColor="bg-yellow-600" />

      <SignalFeedFilters
        sort={sort}
        timeFrame={timeFrame}
        onSortChange={handleSortChange}
        onTimeFrameChange={handleTimeFrameChange}
        titleQuery={titleInput}
        onTitleQueryChange={onTitleChange}
        trailing={
          <SignalViewSwitch
            view={view}
            onViewChange={handleViewChange}
            columns={laneColumns}
            onColumnsChange={handleLaneColumnsChange}
          />
        }
        action={
          canMutate ? (
            <div className="shrink-0">
              <ActionGate
                kind="create-signal"
                fullAppPath={`/${lang}/dho/${spaceSlug}/coherence/new-signal`}
                label={t('newSignal')}
              >
                <Button asChild variant="default" colorVariant="accent">
                  <Link
                    href={`/${lang}/dho/${spaceSlug}/coherence/new-signal`}
                    scroll={false}
                  >
                    {t('newSignal')}
                  </Link>
                </Button>
              </ActionGate>
            </div>
          ) : null
        }
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
          {titleQuery.trim() && hasSignals
            ? t('signalTitleNoResults')
            : t('listIsEmpty')}
        </p>
      ) : view === 'swimlanes' ? (
        <SignalSwimlanes
          lanes={lanes}
          columns={laneColumns}
          spaceSlug={spaceSlug}
          renderSignal={renderSignal}
          onMoveToBoard={canUpdateTasks ? handleMoveToBoard : undefined}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {ranked.map((signal) => (
            <React.Fragment key={signal.id}>
              {renderSignal(signal)}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
