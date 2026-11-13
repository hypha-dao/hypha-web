import { describe, expect, it } from 'vitest';
import {
  applyPendingSignalUpvotes,
  mergePendingSignalUpvotes,
} from '../client/hooks/useFindCoherences';
import { rankSignals } from '../signal-ranking';
import type { Coherence, CoherenceUpvoteSummary } from '../types';

function summary(
  partial: Partial<CoherenceUpvoteSummary>,
): CoherenceUpvoteSummary {
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
    ...partial,
  };
}

function signal(slug: string, upvotes: CoherenceUpvoteSummary): Coherence {
  return {
    slug,
    upvotes,
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
  } as Coherence;
}

describe('mergePendingSignalUpvotes', () => {
  it('writes the new vote into the list so ranking updates before a refetch', () => {
    const stale = summary({ netVoteCount: 0, totalVotingPower: '0' });
    const voted = summary({
      netVoteCount: -1,
      downvoteCount: 1,
      downVotingPower: '4',
      totalVotingPower: '-4',
      myUpvote: { votingPower: '4', maxVotingPower: '4', direction: 'down' },
    });
    const quiet = signal('quiet', summary({ netVoteCount: 2, upvoteCount: 2 }));
    const loud = signal('loud', stale);

    applyPendingSignalUpvotes('space', 'loud', voted);

    const merged = mergePendingSignalUpvotes('space', [quiet, loud]);
    expect(merged[1]?.upvotes).toEqual(voted);
    expect(merged[0]?.upvotes?.netVoteCount).toBe(2);

    const ranked = rankSignals(merged, {
      sort: 'top-voters',
      timeFrame: 'all',
    });
    expect(ranked.map((item) => item.slug)).toEqual(['quiet', 'loud']);

    const otherSpace = mergePendingSignalUpvotes('other', [loud]);
    expect(otherSpace[0]?.upvotes).toBe(stale);
  });

  it('keeps the pending vote when a fetch started before the write, then drops it once the server agrees', () => {
    const pending = summary({
      netVoteCount: 1,
      upvoteCount: 1,
      upVotingPower: '10',
      totalVotingPower: '10',
      myUpvote: { votingPower: '10', maxVotingPower: '10', direction: 'up' },
    });
    const stale = summary({ netVoteCount: 0 });
    applyPendingSignalUpvotes('space', 'sig', pending);

    const during = mergePendingSignalUpvotes('space', [signal('sig', stale)], {
      fromFetch: true,
    });
    expect(during[0]?.upvotes).toEqual(pending);

    const after = mergePendingSignalUpvotes('space', [signal('sig', pending)], {
      fromFetch: true,
    });
    expect(after[0]?.upvotes).toEqual(pending);

    const cleared = mergePendingSignalUpvotes('space', [
      signal('sig', summary({ netVoteCount: 0 })),
    ]);
    expect(cleared[0]?.upvotes?.netVoteCount).toBe(0);
  });
});
