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
  'now',
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

export const DEFAULT_SIGNAL_SORT: SignalSort = 'top-voters';

export function parseSignalSort(raw: string | null | undefined): SignalSort {
  return (SIGNAL_SORTS as readonly string[]).includes(raw ?? '')
    ? (raw as SignalSort)
    : DEFAULT_SIGNAL_SORT;
}

const LEGACY_TIME_FRAMES: Record<string, SignalTimeFrame> = {
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

/** Members who upvoted a signal inside the time frame. */
export function signalVotersInTimeFrame(
  upvotes: CoherenceUpvoteSummary | undefined,
  timeFrame: SignalTimeFrame,
): number {
  if (!upvotes) return 0;
  if (timeFrame === 'all') return upvotes.upvoteCount;
  return upvotes.recentUpvotes?.[timeFrame]?.voters ?? 0;
}

export type SignalUpvoteCellMeasure =
  | { kind: 'count'; count: number }
  | { kind: 'power'; raw: string; tokenDecimals: number }
  | { kind: 'loading' };

/**
 * Feed cell figure. Ordinary sorts keep the voter count. Top by voting power
 * shows the time-frame total (all-time `totalVotingPower` when the frame is
 * `all`), never the viewer's own vote. One summary, one token.
 */
export function signalUpvoteCellMeasure({
  sort,
  timeFrame,
  upvotes,
}: {
  sort: SignalSort;
  timeFrame: SignalTimeFrame;
  upvotes?: CoherenceUpvoteSummary | null;
}): SignalUpvoteCellMeasure {
  if (sort !== 'top-power') {
    return { kind: 'count', count: upvotes?.upvoteCount ?? 0 };
  }
  if (upvotes == null) return { kind: 'loading' };
  return {
    kind: 'power',
    raw: signalVotingPowerInTimeFrame(upvotes, timeFrame).toString(),
    tokenDecimals: upvotes.tokenDecimals,
  };
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
 * `new` is newest first. Top sorts rank by support received inside the time
 * frame; ties fall back to all-time support, then newest first, so quiet
 * time frames still read as a sensible list.
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
