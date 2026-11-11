import type {
  Coherence,
  CoherenceUpvoteSummary,
  SignalRecentWindow,
} from './types';

/** Feed sort: newest first, or top by voter count / by voting power. */
export const SIGNAL_SORTS = ['new', 'top-voters', 'top-power'] as const;
export type SignalSort = (typeof SIGNAL_SORTS)[number];

/** Time frame of the Top sorts. `all` is all time. */
export const SIGNAL_TIME_FRAMES = [
  'today',
  'week',
  'month',
  'year',
  'all',
] as const;
export type SignalTimeFrame = (typeof SIGNAL_TIME_FRAMES)[number];

export const SIGNAL_RECENT_WINDOWS = [
  'now',
  'today',
  'week',
  'month',
  'year',
] as const satisfies readonly SignalRecentWindow[];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const SIGNAL_RECENT_WINDOW_MS: Record<SignalRecentWindow, number> = {
  now: HOUR_MS,
  today: DAY_MS,
  week: 7 * DAY_MS,
  month: 30 * DAY_MS,
  year: 365 * DAY_MS,
};

export const DEFAULT_SIGNAL_TIME_FRAME: SignalTimeFrame = 'week';

export const DEFAULT_SIGNAL_SORT: SignalSort = 'new';

export function parseSignalSort(raw: string | null | undefined): SignalSort {
  return (SIGNAL_SORTS as readonly string[]).includes(raw ?? '')
    ? (raw as SignalSort)
    : DEFAULT_SIGNAL_SORT;
}

const LEGACY_TIME_FRAMES: Record<string, SignalTimeFrame> = {
  // The past-hour option is gone. Old `t=now` links use this week's window.
  now: 'week',
  '7d': 'week',
  '30d': 'month',
};

export function parseSignalTimeFrame(
  raw: string | null | undefined,
): SignalTimeFrame {
  if ((SIGNAL_TIME_FRAMES as readonly string[]).includes(raw ?? '')) {
    return raw as SignalTimeFrame;
  }
  return LEGACY_TIME_FRAMES[raw ?? ''] ?? DEFAULT_SIGNAL_TIME_FRAME;
}

function toBigInt(raw: string | undefined): bigint {
  try {
    return BigInt(raw ?? '0');
  } catch {
    return 0n;
  }
}

/** Voting power a signal received inside the time frame. */
export function signalVotingPowerInTimeFrame(
  upvotes: CoherenceUpvoteSummary | undefined,
  timeFrame: SignalTimeFrame,
): bigint {
  if (!upvotes) return 0n;
  if (timeFrame === 'all') return toBigInt(upvotes.totalVotingPower);
  return toBigInt(upvotes.recentUpvotes?.[timeFrame]?.votingPower);
}

/** Net voters (up minus down) inside the time frame. */
export function signalVotersInTimeFrame(
  upvotes: CoherenceUpvoteSummary | undefined,
  timeFrame: SignalTimeFrame,
): number {
  if (!upvotes) return 0;
  if (timeFrame === 'all') return upvotes.netVoteCount ?? upvotes.upvoteCount;
  return upvotes.recentUpvotes?.[timeFrame]?.voters ?? 0;
}

export type SignalUpvoteCellMeasure =
  | { kind: 'count'; count: number }
  | { kind: 'power'; raw: string; tokenDecimals: number }
  | { kind: 'loading' }
  | { kind: 'error' };

/**
 * Whether the list payload's upvote field is still in flight, came back from
 * a successful fetch, or failed. A settled payload can omit the summary when
 * nobody has voted (older cached lists). That is a zero, not a pending request.
 */
export type SignalUpvoteSummaryState = 'loading' | 'ready' | 'error';

/**
 * Cached and fresh lists that already have rows are settled, even while a
 * newer request is loading or has failed. Only a request with no payload yet
 * is pending, and a failure with no payload must not be shown as zero.
 */
export function signalListUpvoteSummaryState({
  hasSettledList,
  isLoading,
  hasError,
}: {
  hasSettledList: boolean;
  isLoading: boolean;
  hasError: boolean;
}): SignalUpvoteSummaryState {
  if (hasSettledList) return 'ready';
  if (hasError) return 'error';
  if (isLoading) return 'loading';
  return 'ready';
}

/**
 * Feed cell figure. Top by voting power shows the all-time net token total
 * (up minus down). Every other sort shows the all-time net voter count.
 * The selected time window ranks the list and does not change this number.
 * Never the viewer's own vote. One summary, one token.
 */
export function signalUpvoteCellMeasure({
  sort,
  upvotes,
  summaryState = 'ready',
}: {
  sort: SignalSort;
  upvotes?: CoherenceUpvoteSummary | null;
  summaryState?: SignalUpvoteSummaryState;
}): SignalUpvoteCellMeasure {
  if (sort !== 'top-power') {
    return {
      kind: 'count',
      count: upvotes?.netVoteCount ?? upvotes?.upvoteCount ?? 0,
    };
  }
  if (upvotes != null) {
    return {
      kind: 'power',
      raw: toBigInt(upvotes.totalVotingPower).toString(),
      tokenDecimals: upvotes.tokenDecimals,
    };
  }
  if (summaryState === 'loading') return { kind: 'loading' };
  if (summaryState === 'error') return { kind: 'error' };
  return { kind: 'power', raw: '0', tokenDecimals: 0 };
}

/** Case-insensitive title match. Blank query matches every signal. */
export function signalMatchesTitle(
  title: string | null | undefined,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return (title ?? '').toLocaleLowerCase().includes(needle);
}

/**
 * Title filter over an already-complete list. Callers that page the API must
 * concatenate every page before filtering so a match past page one is kept.
 */
export function filterSignalsByTitle<T extends { title?: string | null }>(
  signals: readonly T[],
  query: string,
): T[] {
  const needle = query.trim();
  if (!needle) return [...signals];
  return signals.filter((signal) => signalMatchesTitle(signal.title, needle));
}

function createdAtMs(signal: Pick<Coherence, 'createdAt'>): number {
  const ms = new Date(signal.createdAt).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

function compareDesc(a: bigint | number, b: bigint | number): number {
  return a === b ? 0 : b > a ? 1 : -1;
}

/**
 * `new` is newest first. Top sorts rank by net support (up minus down)
 * received inside the time frame; ties fall back to all-time net support,
 * then newest first, so quiet time frames still read as a sensible list.
 */
export function rankSignals<T extends Pick<Coherence, 'createdAt' | 'upvotes'>>(
  signals: readonly T[],
  { sort, timeFrame }: { sort: SignalSort; timeFrame: SignalTimeFrame },
): T[] {
  const score =
    sort === 'top-voters'
      ? (signal: T, frame: SignalTimeFrame) =>
          signalVotersInTimeFrame(signal.upvotes, frame)
      : (signal: T, frame: SignalTimeFrame) =>
          signalVotingPowerInTimeFrame(signal.upvotes, frame);
  return [...signals].sort((a, b) => {
    if (sort !== 'new') {
      const inFrame = compareDesc(score(a, timeFrame), score(b, timeFrame));
      if (inFrame !== 0) return inFrame;
      const allTime = compareDesc(score(a, 'all'), score(b, 'all'));
      if (allTime !== 0) return allTime;
    }
    return createdAtMs(b) - createdAtMs(a);
  });
}
