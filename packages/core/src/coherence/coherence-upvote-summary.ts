import {
  SIGNAL_RECENT_WINDOWS,
  SIGNAL_RECENT_WINDOW_MS,
} from './signal-ranking';
import type {
  CoherenceUpvoteSummary,
  CoherenceUpvoter,
  SignalRecentWindow,
  SignalVoteDirection,
  SignalWindowUpvotes,
} from './types';

const MAX_VOTERS_PER_SUMMARY = 12;

export type CoherenceUpvoteAggregateRow = {
  coherenceId: number;
  personId: number;
  votingPower: string;
  maxVotingPower: string;
  tokenDecimals: number;
  createdAt: Date | string;
  /** When the current direction was last written. Falls back to createdAt. */
  updatedAt?: Date | string | null;
  /** Missing rows from before downvotes are upvotes. Any other value counts as up. */
  direction?: string | null;
  name: string | null;
  surname: string | null;
  avatarUrl: string | null;
};

export function signalVoteDirection(
  direction: string | null | undefined,
): SignalVoteDirection {
  return direction === 'down' ? 'down' : 'up';
}

/** A settled summary for a signal that has no upvote rows. */
export function emptyCoherenceUpvoteSummary(): CoherenceUpvoteSummary {
  return {
    totalVotingPower: '0',
    upvoteCount: 0,
    downvoteCount: 0,
    upVotingPower: '0',
    downVotingPower: '0',
    netVoteCount: 0,
    tokenDecimals: 0,
    voters: [],
    myUpvote: null,
    recentUpvotes: Object.fromEntries(
      SIGNAL_RECENT_WINDOWS.map((window) => [
        window,
        { votingPower: '0', voters: 0 },
      ]),
    ) as Record<SignalRecentWindow, SignalWindowUpvotes>,
  };
}

function emptyRecentTotals(): Record<
  SignalRecentWindow,
  { votingPower: bigint; voters: number }
> {
  return Object.fromEntries(
    SIGNAL_RECENT_WINDOWS.map((window) => [
      window,
      { votingPower: 0n, voters: 0 },
    ]),
  ) as Record<SignalRecentWindow, { votingPower: bigint; voters: number }>;
}

/**
 * One summary per requested signal. Signals with no rows stay at zero for
 * every time frame — a missing row is not an in-flight request. Totals are
 * the net of each voter's raw power (up minus down), using one token decimals.
 */
export function aggregateCoherenceUpvoteSummaries({
  coherenceIds,
  rows,
  viewerPersonId,
  now = Date.now(),
}: {
  coherenceIds: readonly number[];
  rows: readonly CoherenceUpvoteAggregateRow[];
  viewerPersonId?: number | null;
  now?: number;
}): Record<number, CoherenceUpvoteSummary> {
  const summaries: Record<number, CoherenceUpvoteSummary> = {};
  for (const coherenceId of coherenceIds) {
    if (!Number.isFinite(coherenceId)) continue;
    summaries[coherenceId] ??= emptyCoherenceUpvoteSummary();
  }

  const totals = new Map<number, bigint>();
  const upPower = new Map<number, bigint>();
  const downPower = new Map<number, bigint>();
  const recent = new Map<
    number,
    Record<SignalRecentWindow, { votingPower: bigint; voters: number }>
  >();

  for (const row of rows) {
    const summary = summaries[row.coherenceId];
    if (!summary) continue;
    let power: bigint;
    try {
      power = BigInt(row.votingPower);
    } catch {
      power = 0n;
    }
    if (power < 0n) power = -power;
    const direction = signalVoteDirection(row.direction);
    const signed = direction === 'down' ? -power : power;
    const people = direction === 'down' ? -1 : 1;
    totals.set(row.coherenceId, (totals.get(row.coherenceId) ?? 0n) + signed);
    const castAt = new Date(row.updatedAt ?? row.createdAt).getTime();
    let windows = recent.get(row.coherenceId);
    if (!windows) {
      windows = emptyRecentTotals();
      recent.set(row.coherenceId, windows);
    }
    if (!Number.isNaN(castAt)) {
      for (const window of SIGNAL_RECENT_WINDOWS) {
        if (castAt < now - SIGNAL_RECENT_WINDOW_MS[window]) continue;
        windows[window].votingPower += signed;
        windows[window].voters += people;
      }
    }
    if (direction === 'down') {
      summary.downvoteCount += 1;
      downPower.set(
        row.coherenceId,
        (downPower.get(row.coherenceId) ?? 0n) + power,
      );
    } else {
      summary.upvoteCount += 1;
      upPower.set(
        row.coherenceId,
        (upPower.get(row.coherenceId) ?? 0n) + power,
      );
    }
    summary.tokenDecimals = Math.max(summary.tokenDecimals, row.tokenDecimals);
    const voter: CoherenceUpvoter = {
      personId: row.personId,
      name: [row.name, row.surname].filter(Boolean).join(' ').trim() || null,
      avatarUrl: row.avatarUrl,
      votingPower: power.toString(),
      direction,
    };
    summary.voters.push(voter);
    if (viewerPersonId != null && row.personId === viewerPersonId) {
      summary.myUpvote = {
        votingPower: power.toString(),
        maxVotingPower: row.maxVotingPower,
        direction,
      };
    }
  }

  for (const [coherenceId, summary] of Object.entries(summaries)) {
    const id = Number(coherenceId);
    summary.totalVotingPower = (totals.get(id) ?? 0n).toString();
    summary.upVotingPower = (upPower.get(id) ?? 0n).toString();
    summary.downVotingPower = (downPower.get(id) ?? 0n).toString();
    summary.netVoteCount = summary.upvoteCount - summary.downvoteCount;
    const windows = recent.get(id) ?? emptyRecentTotals();
    summary.recentUpvotes = Object.fromEntries(
      SIGNAL_RECENT_WINDOWS.map((window) => [
        window,
        {
          votingPower: windows[window].votingPower.toString(),
          voters: windows[window].voters,
        },
      ]),
    ) as Record<SignalRecentWindow, SignalWindowUpvotes>;
    summary.voters.sort((a, b) => {
      const diff = BigInt(b.votingPower) - BigInt(a.votingPower);
      return diff > 0n ? 1 : diff < 0n ? -1 : 0;
    });
    summary.voters = summary.voters.slice(0, MAX_VOTERS_PER_SUMMARY);
  }

  return summaries;
}
