import { describe, expect, it } from 'vitest';

import {
  type NetworkHorizonCandidate,
  rankNetworkHorizonSignals,
} from '../network-horizon';

function candidate(
  overrides: Partial<NetworkHorizonCandidate> &
    Pick<NetworkHorizonCandidate, 'id' | 'title' | 'spaceSlug'>,
): NetworkHorizonCandidate {
  return {
    slug: `signal-${overrides.id}`,
    type: 'Need',
    description: null,
    tags: [],
    updatedAt: '2026-10-01T00:00:00.000Z',
    spaceTitle: overrides.spaceSlug,
    spaceDescription: null,
    spaceLocation: null,
    creatorId: 9,
    creatorName: null,
    creatorAvatarUrl: null,
    ...overrides,
  };
}

const profile = {
  location: 'Lisbon',
  description: 'I work with regenerative agriculture.',
  spaceTitles: ['Mountain Lake Energy'],
  spaceDescriptions: ['A community microgrid for the valley.'],
  interestTags: ['seed'],
};

describe('rankNetworkHorizonSignals', () => {
  it('keeps a signal that shares a place, an interest, or experience', () => {
    const ranked = rankNetworkHorizonSignals(profile, [
      candidate({
        id: 1,
        title: 'Greenhouse seed',
        spaceSlug: 'coast',
        spaceLocation: 'Lisbon',
        tags: ['seed'],
        description: 'We need seed for the greenhouse.',
      }),
      candidate({
        id: 2,
        title: 'Unrelated filing',
        spaceSlug: 'archive',
        spaceLocation: 'Oslo',
        description: 'Minutes from last year.',
      }),
    ]);

    expect(ranked.map((item) => item.id)).toEqual([1]);
    expect(ranked[0]?.relevance.reasons).toEqual(
      expect.arrayContaining(['location', 'interest']),
    );
  });

  it('returns nothing when the member has no overlap', () => {
    expect(
      rankNetworkHorizonSignals(
        {
          location: null,
          description: null,
          spaceTitles: [],
          spaceDescriptions: [],
          interestTags: [],
        },
        [
          candidate({
            id: 3,
            title: 'Open call',
            spaceSlug: 'far',
            spaceLocation: 'Lisbon',
          }),
        ],
      ),
    ).toEqual([]);
  });

  it('does not let one space fill the feed', () => {
    const ranked = rankNetworkHorizonSignals(
      profile,
      [
        candidate({
          id: 10,
          title: 'Seed one',
          spaceSlug: 'same',
          tags: ['seed'],
          updatedAt: '2026-10-03T00:00:00.000Z',
        }),
        candidate({
          id: 11,
          title: 'Seed two',
          spaceSlug: 'same',
          tags: ['seed'],
          updatedAt: '2026-10-02T00:00:00.000Z',
        }),
        candidate({
          id: 12,
          title: 'Energy share',
          spaceSlug: 'other',
          type: 'Opportunity',
          description: 'A microgrid share for the valley.',
          updatedAt: '2026-09-01T00:00:00.000Z',
        }),
      ],
      2,
    );

    expect(ranked.map((item) => item.spaceSlug)).toEqual(['same', 'other']);
  });

  it('caps the feed', () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      candidate({
        id: index + 1,
        title: `Seed ${index}`,
        spaceSlug: `space-${index}`,
        tags: ['seed'],
      }),
    );
    expect(rankNetworkHorizonSignals(profile, many)).toHaveLength(6);
  });

  it('leaves out types that are not a need or an opportunity', () => {
    expect(
      rankNetworkHorizonSignals(profile, [
        candidate({
          id: 4,
          title: 'Seed note',
          type: 'Insight',
          spaceSlug: 'notes',
          tags: ['seed'],
        }),
      ]),
    ).toEqual([]);
  });
});
