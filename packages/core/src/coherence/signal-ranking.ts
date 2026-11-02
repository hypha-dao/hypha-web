import type { Coherence, CoherenceUpvoteSummary } from './types';

export const SIGNAL_TOP_WINDOWS = ['7d', '30d', 'all'] as const;

export type SignalTopWindow = (typeof SIGNAL_TOP_WINDOWS)[number];

export const DEFAULT_SIGNAL_TOP_WINDOW: SignalTopWindow = '7d';

export function parseSignalTopWindow(
  raw: string | null | undefined,
): SignalTopWindow {
  return (SIGNAL_TOP_WINDOWS as readonly string[]).includes(raw ?? '')
    ? (raw as SignalTopWindow)
    : DEFAULT_SIGNAL_TOP_WINDOW;
}

function toBigInt(raw: string | undefined): bigint {
  try {
    return BigInt(raw ?? '0');
  } catch {
    return 0n;
  }
}

/** Voting power a signal received inside the window (all time for `all`). */
export function signalVotingPowerInWindow(
  upvotes: CoherenceUpvoteSummary | undefined,
  window: SignalTopWindow,
): bigint {
  if (!upvotes) return 0n;
  if (window === 'all') return toBigInt(upvotes.totalVotingPower);
  const recent = upvotes.recentVotingPower;
  if (!recent) return 0n;
  return toBigInt(window === '7d' ? recent.last7Days : recent.last30Days);
}

function createdAtMs(signal: Pick<Coherence, 'createdAt'>): number {
  const ms = new Date(signal.createdAt).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Highest upvotes in the window first. Ties fall back to all-time upvotes,
 * then newest first, so quiet windows still read as a sensible list.
 */
export function rankSignalsByWindow<
  T extends Pick<Coherence, 'createdAt' | 'upvotes'>,
>(signals: readonly T[], window: SignalTopWindow): T[] {
  return [...signals].sort((a, b) => {
    const inWindow =
      signalVotingPowerInWindow(b.upvotes, window) -
      signalVotingPowerInWindow(a.upvotes, window);
    if (inWindow !== 0n) return inWindow > 0n ? 1 : -1;
    const allTime =
      signalVotingPowerInWindow(b.upvotes, 'all') -
      signalVotingPowerInWindow(a.upvotes, 'all');
    if (allTime !== 0n) return allTime > 0n ? 1 : -1;
    return createdAtMs(b) - createdAtMs(a);
  });
}
