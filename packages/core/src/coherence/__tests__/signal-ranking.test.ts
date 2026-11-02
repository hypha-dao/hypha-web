import { describe, expect, it } from 'vitest';
import {
  availableSignalSorts,
  defaultSignalSort,
  parseSignalSort,
  parseSignalTimeFrame,
  rankSignals,
  signalVotersInTimeFrame,
  signalVotingPowerInTimeFrame,
  type SignalSort,
  type SignalTimeFrame,
} from '../signal-ranking';
import type { CoherenceUpvoteSummary, SignalRecentWindow } from '../types';

type Window = { power: string; voters: number };

function upvotes(
  total: { power: string; voters: number },
  recent: Partial<Record<SignalRecentWindow, Window>>,
): CoherenceUpvoteSummary {
  const window = (key: SignalRecentWindow) => ({
    votingPower: recent[key]?.power ?? '0',
    voters: recent[key]?.voters ?? 0,
  });
  return {
    totalVotingPower: total.power,
    upvoteCount: total.voters,
    tokenDecimals: 0,
    voters: [],
    myUpvote: null,
    recentUpvotes: {
      now: window('now'),
      today: window('today'),
      week: window('week'),
      month: window('month'),
      year: window('year'),
    },
  };
}

// One whale on `old`, many small voters on `crowd`.
const old = {
  id: 'old',
  createdAt: new Date('2026-01-01'),
  upvotes: upvotes(
    { power: '50', voters: 1 },
    { year: { power: '50', voters: 1 } },
  ),
};
const crowd = {
  id: 'crowd',
  createdAt: new Date('2026-10-10'),
  upvotes: upvotes(
    { power: '20', voters: 4 },
    {
      month: { power: '20', voters: 4 },
      year: { power: '20', voters: 4 },
    },
  ),
};
const week = {
  id: 'week',
  createdAt: new Date('2026-10-30'),
  upvotes: upvotes(
    { power: '5', voters: 2 },
    {
      today: { power: '5', voters: 2 },
      week: { power: '5', voters: 2 },
      month: { power: '5', voters: 2 },
      year: { power: '5', voters: 2 },
    },
  ),
};
const none = { id: 'none', createdAt: new Date('2026-11-01') };

describe('signal sort defaults', () => {
  it('defaults to top by voting power unless each member has one vote', () => {
    expect(defaultSignalSort('token')).toBe('top-power');
    expect(defaultSignalSort(null)).toBe('top-power');
    expect(defaultSignalSort('one-member-one-vote')).toBe('top-voters');
  });

  it('drops top by voting power only in one member, one vote spaces', () => {
    expect(availableSignalSorts('token')).toEqual([
      'new',
      'top-voters',
      'top-power',
    ]);
    expect(availableSignalSorts('one-member-one-vote')).toEqual([
      'new',
      'top-voters',
    ]);
  });

  it('keeps the default sort selectable while the voting method loads', () => {
    expect(availableSignalSorts(null)).toContain(defaultSignalSort(null));
    expect(availableSignalSorts(null)).toContain(parseSignalSort(null, null));
  });

  it('parses sorts against the voting method', () => {
    expect(parseSignalSort('new', 'token')).toBe('new');
    expect(parseSignalSort('top-power', 'one-member-one-vote')).toBe(
      'top-voters',
    );
    expect(parseSignalSort('bogus', 'token')).toBe('top-power');
  });

  it('defaults the time frame to this week and maps legacy windows', () => {
    expect(parseSignalTimeFrame(null)).toBe('week');
    expect(parseSignalTimeFrame('bogus')).toBe('week');
    expect(parseSignalTimeFrame('year')).toBe('year');
    expect(parseSignalTimeFrame('30d')).toBe('month');
  });
});

describe('time frame totals', () => {
  it('reads the matching time frame', () => {
    expect(signalVotingPowerInTimeFrame(crowd.upvotes, 'week')).toBe(0n);
    expect(signalVotingPowerInTimeFrame(crowd.upvotes, 'month')).toBe(20n);
    expect(signalVotingPowerInTimeFrame(crowd.upvotes, 'all')).toBe(20n);
    expect(signalVotersInTimeFrame(crowd.upvotes, 'month')).toBe(4);
    expect(signalVotersInTimeFrame(crowd.upvotes, 'all')).toBe(4);
  });

  it('treats a missing summary as no votes', () => {
    expect(signalVotingPowerInTimeFrame(undefined, 'all')).toBe(0n);
    expect(signalVotersInTimeFrame(undefined, 'today')).toBe(0);
  });
});

describe('rankSignals', () => {
  const signals = [none, old, crowd, week];
  const ids = (sort: SignalSort, timeFrame: SignalTimeFrame = 'all') =>
    rankSignals(signals, { sort, timeFrame }).map((signal) => signal.id);

  it('lists newest first for New', () => {
    expect(ids('new', 'today')).toEqual(['none', 'week', 'crowd', 'old']);
  });

  it('ranks by voting power inside the time frame', () => {
    expect(ids('top-power', 'week')).toEqual(['week', 'old', 'crowd', 'none']);
    expect(ids('top-power', 'month')).toEqual(['crowd', 'week', 'old', 'none']);
    expect(ids('top-power', 'all')).toEqual(['old', 'crowd', 'week', 'none']);
  });

  it('ranks by voter count inside the time frame', () => {
    expect(ids('top-voters', 'all')).toEqual(['crowd', 'week', 'old', 'none']);
    expect(ids('top-voters', 'now')).toEqual(['crowd', 'week', 'old', 'none']);
  });

  it('does not mutate the input', () => {
    rankSignals(signals, { sort: 'top-power', timeFrame: 'all' });
    expect(signals.map((signal) => signal.id)).toEqual([
      'none',
      'old',
      'crowd',
      'week',
    ]);
  });
});
