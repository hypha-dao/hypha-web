import { describe, expect, it } from 'vitest';
import {
  parseSignalTopWindow,
  rankSignalsByWindow,
  signalVotingPowerInWindow,
} from '../signal-ranking';
import type { CoherenceUpvoteSummary } from '../types';

function upvotes(
  total: string,
  last7Days: string,
  last30Days: string,
): CoherenceUpvoteSummary {
  return {
    totalVotingPower: total,
    upvoteCount: 1,
    tokenDecimals: 0,
    voters: [],
    myUpvote: null,
    recentVotingPower: { last7Days, last30Days },
  };
}

const old = {
  id: 'old',
  createdAt: new Date('2026-01-01'),
  upvotes: upvotes('50', '0', '0'),
};
const month = {
  id: 'month',
  createdAt: new Date('2026-10-10'),
  upvotes: upvotes('20', '0', '20'),
};
const week = {
  id: 'week',
  createdAt: new Date('2026-10-30'),
  upvotes: upvotes('5', '5', '5'),
};
const none = { id: 'none', createdAt: new Date('2026-11-01') };

describe('parseSignalTopWindow', () => {
  it('defaults to the last 7 days', () => {
    expect(parseSignalTopWindow(null)).toBe('7d');
    expect(parseSignalTopWindow('bogus')).toBe('7d');
  });

  it('accepts the known windows', () => {
    expect(parseSignalTopWindow('30d')).toBe('30d');
    expect(parseSignalTopWindow('all')).toBe('all');
  });
});

describe('signalVotingPowerInWindow', () => {
  it('reads the matching window', () => {
    expect(signalVotingPowerInWindow(month.upvotes, '7d')).toBe(0n);
    expect(signalVotingPowerInWindow(month.upvotes, '30d')).toBe(20n);
    expect(signalVotingPowerInWindow(month.upvotes, 'all')).toBe(20n);
  });

  it('treats a missing summary as no votes', () => {
    expect(signalVotingPowerInWindow(undefined, 'all')).toBe(0n);
  });
});

describe('rankSignalsByWindow', () => {
  const signals = [none, old, month, week];
  const ids = (window: '7d' | '30d' | 'all') =>
    rankSignalsByWindow(signals, window).map((signal) => signal.id);

  it('ranks by upvotes received in the last 7 days', () => {
    expect(ids('7d')).toEqual(['week', 'old', 'month', 'none']);
  });

  it('ranks by upvotes received in the last 30 days', () => {
    expect(ids('30d')).toEqual(['month', 'week', 'old', 'none']);
  });

  it('ranks by all-time upvotes', () => {
    expect(ids('all')).toEqual(['old', 'month', 'week', 'none']);
  });

  it('does not mutate the input', () => {
    rankSignalsByWindow(signals, 'all');
    expect(signals.map((signal) => signal.id)).toEqual([
      'none',
      'old',
      'month',
      'week',
    ]);
  });
});
