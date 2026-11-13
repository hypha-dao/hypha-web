import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SIGNAL_SORT,
  SIGNAL_SORTS,
  filterSignalsByTitle,
  parseSignalSort,
  parseSignalTimeFrame,
  rankSignals,
  SIGNAL_TIME_FRAMES,
  signalListUpvoteSummaryState,
  signalMatchesTitle,
  signalUpvoteCellMeasure,
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
    downvoteCount: 0,
    upVotingPower: total.power,
    downVotingPower: '0',
    netVoteCount: total.voters,
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
  it('offers new, top by voters and top by voting power', () => {
    expect(SIGNAL_SORTS).toEqual(['new', 'top-voters', 'top-power']);
  });

  it('defaults to newest first', () => {
    expect(DEFAULT_SIGNAL_SORT).toBe('new');
    expect(parseSignalSort(null)).toBe('new');
    expect(parseSignalSort('bogus')).toBe('new');
  });

  it('keeps every explicit sort', () => {
    expect(parseSignalSort('new')).toBe('new');
    expect(parseSignalSort('top-voters')).toBe('top-voters');
    expect(parseSignalSort('top-power')).toBe('top-power');
  });

  it('defaults the time frame to this week and maps legacy windows', () => {
    expect(SIGNAL_TIME_FRAMES).toEqual([
      'today',
      'week',
      'month',
      'year',
      'all',
    ]);
    expect(parseSignalTimeFrame(null)).toBe('week');
    expect(parseSignalTimeFrame('bogus')).toBe('week');
    expect(parseSignalTimeFrame('now')).toBe('week');
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
    expect(ids('top-voters', 'today')).toEqual([
      'week',
      'crowd',
      'old',
      'none',
    ]);
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

describe('signalUpvoteCellMeasure', () => {
  it('keeps the all-time voter count for new and top-voters, including zero', () => {
    expect(signalVotersInTimeFrame(crowd.upvotes, 'week')).toBe(0);
    expect(
      signalUpvoteCellMeasure({
        sort: 'new',
        upvotes: crowd.upvotes,
      }),
    ).toEqual({ kind: 'count', count: 4 });
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-voters',
        upvotes: crowd.upvotes,
      }),
    ).toEqual({ kind: 'count', count: 4 });
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-voters',
        upvotes: null,
      }),
    ).toEqual({ kind: 'count', count: 0 });
  });

  it('shows the all-time voting power, not the window, the voter count, or the viewer vote', () => {
    const withMine = {
      ...crowd.upvotes,
      myUpvote: { votingPower: '999', maxVotingPower: '999' },
    };
    expect(signalVotingPowerInTimeFrame(crowd.upvotes, 'week')).toBe(0n);
    expect(signalVotingPowerInTimeFrame(crowd.upvotes, 'today')).toBe(0n);
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        upvotes: withMine,
      }),
    ).toEqual({ kind: 'power', raw: '20', tokenDecimals: 0 });
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        upvotes: old.upvotes,
      }),
    ).toEqual({ kind: 'power', raw: '50', tokenDecimals: 0 });
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        upvotes: week.upvotes,
      }),
    ).toEqual({ kind: 'power', raw: '5', tokenDecimals: 0 });
  });

  it('shows a settled missing summary as zero voting power', () => {
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        upvotes: undefined,
      }),
    ).toEqual({ kind: 'power', raw: '0', tokenDecimals: 0 });
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        upvotes: null,
        summaryState: 'ready',
      }),
    ).toEqual({ kind: 'power', raw: '0', tokenDecimals: 0 });
  });

  it('keeps the ellipsis only while a missing summary is still loading', () => {
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        upvotes: undefined,
        summaryState: 'loading',
      }),
    ).toEqual({ kind: 'loading' });
  });

  it('does not turn a failed missing summary into zero', () => {
    const measure = signalUpvoteCellMeasure({
      sort: 'top-power',
      upvotes: null,
      summaryState: 'error',
    });
    expect(measure).toEqual({ kind: 'error' });
    expect(measure).not.toEqual(
      expect.objectContaining({ kind: 'power', raw: '0' }),
    );
  });

  it('uses the net of up and down for the count and the all-time power total', () => {
    const down = upvotes(
      { power: '-30', voters: 5 },
      { week: { power: '-30', voters: -1 } },
    );
    down.upvoteCount = 2;
    down.downvoteCount = 3;
    down.netVoteCount = -1;
    expect(signalVotersInTimeFrame(down, 'all')).toBe(-1);
    expect(signalVotersInTimeFrame(down, 'week')).toBe(-1);
    expect(
      signalUpvoteCellMeasure({ sort: 'top-voters', upvotes: down }),
    ).toEqual({ kind: 'count', count: -1 });
    expect(signalUpvoteCellMeasure({ sort: 'new', upvotes: down })).toEqual({
      kind: 'count',
      count: -1,
    });
    expect(
      signalUpvoteCellMeasure({ sort: 'top-power', upvotes: down }),
    ).toEqual({ kind: 'power', raw: '-30', tokenDecimals: 0 });
    expect(
      rankSignals(
        [
          crowd,
          {
            id: 'down',
            createdAt: new Date('2026-11-02'),
            upvotes: down,
          },
        ],
        { sort: 'top-voters', timeFrame: 'all' },
      ).map((signal) => signal.id),
    ).toEqual(['crowd', 'down']);
  });

  it('shows the weighted net on every sort in a token space', () => {
    const half = (10n ** 18n / 2n).toString();
    const token = {
      ...crowd.upvotes,
      totalVotingPower: half,
      netVoteCount: 1,
      upvoteCount: 1,
      tokenDecimals: 18,
    };
    for (const sort of ['new', 'top-voters', 'top-power'] as const) {
      expect(
        signalUpvoteCellMeasure({
          sort,
          votingMode: 'token',
          upvotes: token,
        }),
      ).toEqual({ kind: 'power', raw: half, tokenDecimals: 18 });
    }
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        votingMode: 'one-member-one-vote',
        upvotes: { ...token, netVoteCount: 3 },
      }),
    ).toEqual({ kind: 'count', count: 3 });
  });

  it('ranks top by voting power on the raw weighted net', () => {
    const half = {
      id: 'half',
      createdAt: new Date('2026-11-03'),
      upvotes: upvotes({ power: (10n ** 18n / 2n).toString(), voters: 1 }, {}),
    };
    const whole = {
      id: 'whole',
      createdAt: new Date('2026-11-01'),
      upvotes: upvotes({ power: (10n ** 18n).toString(), voters: 1 }, {}),
    };
    half.upvotes.tokenDecimals = 18;
    whole.upvotes.tokenDecimals = 18;
    expect(
      rankSignals([half, whole], { sort: 'top-power', timeFrame: 'all' }).map(
        (signal) => signal.id,
      ),
    ).toEqual(['whole', 'half']);
  });

  it('keeps a cached summary while a later refresh is loading or has failed', () => {
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        upvotes: old.upvotes,
        summaryState: 'loading',
      }),
    ).toEqual({ kind: 'power', raw: '50', tokenDecimals: 0 });
    expect(
      signalUpvoteCellMeasure({
        sort: 'top-power',
        upvotes: crowd.upvotes,
        summaryState: 'error',
      }),
    ).toEqual({ kind: 'power', raw: '20', tokenDecimals: 0 });
  });
});

describe('signalListUpvoteSummaryState', () => {
  it('treats a visible list as settled during refresh and revalidate errors', () => {
    expect(
      signalListUpvoteSummaryState({
        hasSettledList: true,
        isLoading: true,
        hasError: false,
      }),
    ).toBe('ready');
    expect(
      signalListUpvoteSummaryState({
        hasSettledList: true,
        isLoading: false,
        hasError: true,
      }),
    ).toBe('ready');
  });

  it('keeps a payload-less failure distinct from zero and from the first load', () => {
    expect(
      signalListUpvoteSummaryState({
        hasSettledList: false,
        isLoading: true,
        hasError: true,
      }),
    ).toBe('error');
    expect(
      signalListUpvoteSummaryState({
        hasSettledList: false,
        isLoading: false,
        hasError: true,
      }),
    ).toBe('error');
    expect(
      signalListUpvoteSummaryState({
        hasSettledList: false,
        isLoading: true,
        hasError: false,
      }),
    ).toBe('loading');
    expect(
      signalListUpvoteSummaryState({
        hasSettledList: false,
        isLoading: false,
        hasError: false,
      }),
    ).toBe('ready');
  });
});

describe('filterSignalsByTitle', () => {
  const page1 = [
    { id: 'alpha', title: 'Alpha garden', createdAt: new Date('2026-01-01') },
    { id: 'budget', title: 'Budget', createdAt: new Date('2026-02-01') },
  ];
  const page2 = [
    {
      id: 'path',
      title: 'Garden path',
      createdAt: new Date('2026-10-01'),
      description: 'unrelated',
    },
    {
      id: 'body',
      title: 'Soil notes',
      createdAt: new Date('2026-11-01'),
      description: 'mentions a garden only in the body',
    },
  ];

  it('matches titles case-insensitively and ignores description-only hits', () => {
    expect(signalMatchesTitle('Garden path', '  GARDEN ')).toBe(true);
    expect(signalMatchesTitle('Soil notes', 'garden')).toBe(false);
    expect(signalMatchesTitle(null, '   ')).toBe(true);
    const loadedPage = filterSignalsByTitle(page1, 'path');
    const fullList = filterSignalsByTitle([...page1, ...page2], 'path');
    expect(loadedPage).toEqual([]);
    expect(fullList.map((signal) => signal.id)).toEqual(['path']);
  });

  it('filters the concatenated pages, then ranking still applies', () => {
    const quiet = {
      id: 'quiet-garden',
      title: 'Quiet garden',
      createdAt: new Date('2026-03-01'),
      upvotes: upvotes(
        { power: '1', voters: 1 },
        { week: { power: '1', voters: 1 } },
      ),
    };
    const loud = {
      id: 'loud-garden',
      title: 'Loud garden',
      createdAt: new Date('2026-04-01'),
      upvotes: upvotes(
        { power: '9', voters: 1 },
        { week: { power: '9', voters: 1 } },
      ),
    };
    const other = {
      id: 'other',
      title: 'Treasury',
      createdAt: new Date('2026-05-01'),
      upvotes: upvotes(
        { power: '100', voters: 9 },
        { week: { power: '100', voters: 9 } },
      ),
    };
    const visible = filterSignalsByTitle(
      [...page1, quiet, ...page2, other, loud],
      'garden',
    );
    expect(visible.map((signal) => signal.id)).toEqual([
      'alpha',
      'quiet-garden',
      'path',
      'loud-garden',
    ]);
    expect(
      rankSignals(visible, { sort: 'top-power', timeFrame: 'week' }).map(
        (signal) => signal.id,
      ),
    ).toEqual(['loud-garden', 'quiet-garden', 'path', 'alpha']);
  });

  it('returns a copy of every signal when the query is blank', () => {
    const signals = [...page1, ...page2];
    const copy = filterSignalsByTitle(signals, '   ');
    expect(copy).toEqual(signals);
    expect(copy).not.toBe(signals);
  });
});
