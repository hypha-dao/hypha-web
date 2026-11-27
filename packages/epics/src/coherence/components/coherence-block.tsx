'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  canonicalSignalType,
  COHERENCE_OVERVIEW_TYPES,
  DEFAULT_SIGNAL_SORT,
  filterSignalsByTitle,
  parseSignalSort,
  rankSignals,
  signalListUpvoteSummaryState,
  useFindCoherences,
  useSpaceBySlug,
  type CoherenceOverviewType,
  type SignalSort,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Button, ErrorAlert, Skeleton } from '@hypha-platform/ui';
import { CoherenceOrder } from '../types';
import { useCanMutateInSpace } from '../../spaces/hooks/use-can-mutate-in-space.web3.rpc';
import { useCanUpdateSignalTasks } from '../hooks/use-can-update-signal-tasks';
import { getSignalPath } from '../../common/get-path-function';
import { ActionGate } from '../../common/action-capabilities';
import { signalSpaceMembership } from '../hooks/use-is-signal-space-non-member';
import { useSignalProvisioningNotice } from '../hooks/use-signal-provisioning-notice';
import { useSignalRoomActivity } from '../hooks/use-signal-room-activity';
import {
  signalVotingSpaceId,
  useSignalVotingMode,
} from '../hooks/use-signal-voting-mode';
import {
  SignalFeedFilters,
  type SignalFeedPerson,
} from './signal-feed-filters';
import { SignalFeedCard } from './signal-feed-card';
import { SignalFeedLayoutToggle } from './signal-feed-layout-toggle';
import { SignalFeedRow } from './signal-feed-row';
import { useDebouncedFeedTitle } from '../lib/use-debounced-feed-title';
import {
  readStoredSignalFeedLayout,
  writeStoredSignalFeedLayout,
  type SignalFeedLayout,
} from '../lib/signal-feed-layout';
import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import type { UseMembers } from '../../spaces/hooks/types';

export const SIGNAL_SORT_QUERY_KEY = 'sort';
/** Title-only feed search. Distinct from the board's `title` query. */
export const SIGNAL_TITLE_QUERY_KEY = 'q';
export const SIGNAL_PERSON_QUERY_KEY = 'person';
export const SIGNAL_TYPE_QUERY_KEY = 'type';
const ARCHIVED_QUERY_KEY = 'archived';

function parsePersonId(raw: string | null): number | null {
  if (!raw) return null;
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function parseOverviewType(raw: string | null): CoherenceOverviewType | null {
  const value = raw?.split(',')[0]?.trim() ?? '';
  if ((COHERENCE_OVERVIEW_TYPES as readonly string[]).includes(value)) {
    return value as CoherenceOverviewType;
  }
  return null;
}

function FeedPeopleLoader({
  spaceSlug,
  useMembers,
  onPeople,
}: {
  spaceSlug: string;
  useMembers: UseMembers;
  onPeople: (people: SignalFeedPerson[]) => void;
}) {
  const t = useTranslations('CoherenceTab');
  const { persons } = useMembers({
    spaceSlug,
    pageSize: 200,
    paginationDisabled: true,
  });
  const people = React.useMemo(() => {
    return [...(persons?.data ?? [])]
      .map((person) => ({
        id: person.id,
        label: personRosterDisplayLabel(person, t('unknownMember')),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [persons?.data, t]);
  React.useEffect(() => {
    onPeople(people);
  }, [onPeople, people]);
  return null;
}

export type CoherenceBlockProps = {
  lang: Locale;
  spaceSlug: string;
  /** Kept for route compatibility; the feed always ranks by upvotes. */
  order?: CoherenceOrder;
  humanChatEnabled?: boolean;
  useMembers?: UseMembers;
};

export function CoherenceBlock({
  lang,
  spaceSlug,
  useMembers,
}: CoherenceBlockProps) {
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
  const { canUpdateTasks } = useCanUpdateSignalTasks({
    spaceSlug,
    web3SpaceId: space?.web3SpaceId ?? undefined,
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

  const [layout, setLayout] = React.useState<SignalFeedLayout>('list');
  React.useLayoutEffect(() => {
    setLayout(readStoredSignalFeedLayout());
  }, []);
  const handleLayoutChange = React.useCallback((next: SignalFeedLayout) => {
    setLayout(next);
    writeStoredSignalFeedLayout(next);
  }, []);

  const sort = parseSignalSort(searchParams.get(SIGNAL_SORT_QUERY_KEY));
  const personId = parsePersonId(searchParams.get(SIGNAL_PERSON_QUERY_KEY));
  const signalType = parseOverviewType(searchParams.get(SIGNAL_TYPE_QUERY_KEY));
  const [people, setPeople] = React.useState<SignalFeedPerson[]>([]);
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
  const handlePersonChange = React.useCallback(
    (next: number | null) =>
      replaceQuery(
        SIGNAL_PERSON_QUERY_KEY,
        next == null ? '' : String(next),
        '',
      ),
    [replaceQuery],
  );
  const handleTypeChange = React.useCallback(
    (next: CoherenceOverviewType | null) =>
      replaceQuery(SIGNAL_TYPE_QUERY_KEY, next ?? '', ''),
    [replaceQuery],
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
    // `useFindCoherences` already concatenates every page. Filter that full
    // list, then rank across all time, so a match past page one is kept.
    const matched = filterSignalsByTitle(signals ?? [], titleQuery).filter(
      (signal) => {
        if (personId != null) {
          const assignees = signal.assigneeIds ?? [];
          if (signal.creatorId !== personId && !assignees.includes(personId)) {
            return false;
          }
        }
        if (signalType && canonicalSignalType(signal.type) !== signalType) {
          return false;
        }
        return true;
      },
    );
    return rankSignals(matched, { sort, timeFrame: 'all' });
  }, [personId, signalType, signals, sort, titleQuery]);
  const activity = useSignalRoomActivity(ranked);
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
        <SignalFeedLayoutToggle layout={layout} onChange={handleLayoutChange} />
      </header>

      <ErrorAlert lines={provisioningNoticeLines} bgColor="bg-yellow-600" />

      {useMembers ? (
        <FeedPeopleLoader
          spaceSlug={spaceSlug}
          useMembers={useMembers}
          onPeople={setPeople}
        />
      ) : null}
      <SignalFeedFilters
        sort={sort}
        onSortChange={handleSortChange}
        personId={personId}
        people={people}
        onPersonChange={handlePersonChange}
        signalType={signalType}
        onTypeChange={handleTypeChange}
        titleQuery={titleInput}
        onTitleQueryChange={onTitleChange}
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
        <div
          className={
            layout === 'cards'
              ? 'grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3'
              : 'flex flex-col gap-2'
          }
        >
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton
              key={index}
              loading
              className={
                layout === 'cards'
                  ? 'h-[180px] w-full rounded-none'
                  : 'h-[104px] w-full rounded-none'
              }
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
      ) : (
        <div
          className={
            layout === 'cards'
              ? 'grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-3'
              : 'flex flex-col gap-2'
          }
        >
          {ranked.map((signal) => {
            if (!signal.slug) return null;
            const itemProps = {
              signal,
              spaceSlug,
              href: getSignalPath(lang, spaceSlug, signal.slug),
              votingMode,
              votingModeStatus,
              onRetryVotingMode: retryVotingMode,
              isNonMember,
              isMembershipPending,
              activity: signal.roomId ? activity[signal.roomId] : undefined,
              refresh,
              sort,
              summaryState: upvoteSummaryState,
              canEditDomain: canUpdateTasks,
              spaceBanner: space?.leadImage,
            };
            return layout === 'cards' ? (
              <SignalFeedCard key={signal.id} {...itemProps} />
            ) : (
              <SignalFeedRow key={signal.id} {...itemProps} />
            );
          })}
        </div>
      )}
    </div>
  );
}
