import { describe, expect, it } from 'vitest';
import {
  aggregateCoherenceUpvoteSummaries,
  emptyCoherenceUpvoteSummary,
  type CoherenceUpvoteAggregateRow,
} from '../coherence-upvote-summary';
import {
  SIGNAL_RECENT_WINDOWS,
  SIGNAL_TIME_FRAMES,
  signalVotingPowerInTimeFrame,
} from '../signal-ranking';

const NOW = Date.parse('2026-06-15T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function row(
  partial: CoherenceUpvoteAggregateRow,
): CoherenceUpvoteAggregateRow {
  return partial;
}

describe('aggregateCoherenceUpvoteSummaries', () => {
  const rows = [
    row({
      coherenceId: 1,
      personId: 10,
      votingPower: '3000000000000000000',
      maxVotingPower: '5000000000000000000',
      tokenDecimals: 18,
      createdAt: new Date(NOW - 2 * DAY_MS).toISOString(),
      name: 'Ada',
      surname: 'Lovelace',
      avatarUrl: null,
    }),
    row({
      coherenceId: 1,
      personId: 11,
      votingPower: '1000000000000000000',
      maxVotingPower: '4000000000000000000',
      tokenDecimals: 18,
      createdAt: new Date(NOW - 20 * DAY_MS).toISOString(),
      name: 'Grace',
      surname: 'Hopper',
      avatarUrl: null,
    }),
    row({
      coherenceId: 3,
      personId: 12,
      votingPower: '7',
      maxVotingPower: '9',
      tokenDecimals: 0,
      createdAt: new Date(NOW - 200 * DAY_MS).toISOString(),
      name: 'Old',
      surname: null,
      avatarUrl: null,
    }),
    row({
      coherenceId: 99,
      personId: 13,
      votingPower: '50',
      maxVotingPower: '50',
      tokenDecimals: 0,
      createdAt: new Date(NOW).toISOString(),
      name: 'Ignored',
      surname: null,
      avatarUrl: null,
    }),
  ];

  const summaries = aggregateCoherenceUpvoteSummaries({
    coherenceIds: [1, 2, 3],
    rows,
    viewerPersonId: 11,
    now: NOW,
  });

  it('sums unequal weights from more than one voter and keeps the viewer vote separate', () => {
    const voted = summaries[1];
    expect(voted?.upvoteCount).toBe(2);
    expect(voted?.totalVotingPower).toBe('4000000000000000000');
    expect(voted?.tokenDecimals).toBe(18);
    expect(voted?.downvoteCount).toBe(0);
    expect(voted?.netVoteCount).toBe(2);
    expect(voted?.myUpvote).toEqual({
      votingPower: '1000000000000000000',
      maxVotingPower: '4000000000000000000',
      direction: 'up',
    });
    expect(voted?.myUpvote?.votingPower).not.toBe(voted?.totalVotingPower);
    expect(voted?.voters.map((voter) => voter.personId)).toEqual([10, 11]);
    expect(signalVotingPowerInTimeFrame(voted, 'week').toString()).toBe(
      '3000000000000000000',
    );
    expect(signalVotingPowerInTimeFrame(voted, 'month').toString()).toBe(
      '4000000000000000000',
    );
    expect(signalVotingPowerInTimeFrame(voted, 'all').toString()).toBe(
      '4000000000000000000',
    );
  });

  it('returns an explicit zero for every time frame when a signal has no rows', () => {
    const empty = summaries[2];
    expect(empty).toEqual(emptyCoherenceUpvoteSummary());
    for (const timeFrame of SIGNAL_TIME_FRAMES) {
      expect(signalVotingPowerInTimeFrame(empty, timeFrame)).toBe(0n);
    }
    for (const window of SIGNAL_RECENT_WINDOWS) {
      expect(empty?.recentUpvotes?.[window]).toEqual({
        votingPower: '0',
        voters: 0,
      });
    }
  });

  it('counts an older vote only in the windows that contain it', () => {
    const older = summaries[3];
    expect(older?.upvoteCount).toBe(1);
    expect(older?.totalVotingPower).toBe('7');
    expect(signalVotingPowerInTimeFrame(older, 'week').toString()).toBe('0');
    expect(signalVotingPowerInTimeFrame(older, 'month').toString()).toBe('0');
    expect(signalVotingPowerInTimeFrame(older, 'year').toString()).toBe('7');
    expect(signalVotingPowerInTimeFrame(older, 'all').toString()).toBe('7');
    expect(summaries[99]).toBeUndefined();
  });

  it('subtracts a downvote and dates it from the direction change', () => {
    const mixed = aggregateCoherenceUpvoteSummaries({
      coherenceIds: [7],
      viewerPersonId: 2,
      now: NOW,
      rows: [
        row({
          coherenceId: 7,
          personId: 1,
          votingPower: '10',
          maxVotingPower: '10',
          tokenDecimals: 0,
          createdAt: new Date(NOW - 2 * DAY_MS).toISOString(),
          name: 'Up',
          surname: null,
          avatarUrl: null,
        }),
        row({
          coherenceId: 7,
          personId: 2,
          votingPower: '4',
          maxVotingPower: '10',
          tokenDecimals: 0,
          direction: 'down',
          createdAt: new Date(NOW - 40 * DAY_MS).toISOString(),
          updatedAt: new Date(NOW - DAY_MS).toISOString(),
          name: 'Down',
          surname: null,
          avatarUrl: null,
        }),
      ],
    });
    const summary = mixed[7];
    expect(summary?.upvoteCount).toBe(1);
    expect(summary?.downvoteCount).toBe(1);
    expect(summary?.upVotingPower).toBe('10');
    expect(summary?.downVotingPower).toBe('4');
    expect(summary?.netVoteCount).toBe(0);
    expect(summary?.totalVotingPower).toBe('6');
    expect(summary?.myUpvote).toEqual({
      votingPower: '4',
      maxVotingPower: '10',
      direction: 'down',
    });
    expect(signalVotingPowerInTimeFrame(summary, 'week').toString()).toBe('6');
    expect(summary?.recentUpvotes?.week.voters).toBe(0);
  });
});
