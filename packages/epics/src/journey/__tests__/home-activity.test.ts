import { describe, expect, it } from 'vitest';
import { isOpenForVote, votesFromDocuments } from '../home-activity';

const space = { slug: 'garden', title: 'Garden' };

describe('home-activity', () => {
  it('treats on-voting proposals as needing a vote', () => {
    expect(isOpenForVote({ state: 'proposal', status: 'onVoting' })).toBe(true);
    expect(isOpenForVote({ state: 'proposal', status: 'accepted' })).toBe(
      false,
    );
    expect(isOpenForVote({ state: 'agreement', status: 'accepted' })).toBe(
      false,
    );
  });

  it('maps open proposals onto vote items', () => {
    const items = votesFromDocuments(
      [
        {
          id: 1,
          title: 'Fund the kitchen',
          slug: 'proposal-1',
          state: 'proposal',
          status: 'onVoting',
        } as never,
        {
          id: 2,
          title: 'Closed',
          slug: 'proposal-2',
          state: 'proposal',
          status: 'rejected',
        } as never,
        {
          id: 3,
          title: 'Discussion only',
          slug: 'discussion-3',
          state: 'discussion',
        } as never,
      ],
      space,
    );

    expect(items).toEqual([
      {
        id: 'garden:1',
        title: 'Fund the kitchen',
        spaceSlug: 'garden',
        spaceTitle: 'Garden',
        proposalSlug: 'proposal-1',
      },
    ]);
  });
});
