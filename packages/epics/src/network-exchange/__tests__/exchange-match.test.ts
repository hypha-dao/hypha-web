import { describe, expect, it } from 'vitest';

import { exchangePairs, reciprocityPercent } from '../exchange-match';

describe('reciprocityPercent', () => {
  it('measures how much of each side is met by the other', () => {
    expect(
      reciprocityPercent(
        { slug: 'a', seeks: ['financial'], offers: ['living'] },
        { slug: 'b', seeks: ['living'], offers: ['financial'] },
      ),
    ).toBe(100);
  });

  it('stays empty when neither side has named a need', () => {
    expect(
      reciprocityPercent(
        { slug: 'a', seeks: [], offers: ['social'] },
        { slug: 'b', seeks: [], offers: ['financial'] },
      ),
    ).toBeNull();
  });
});

describe('exchangePairs', () => {
  it('keeps only pairs that meet a stated need', () => {
    const pairs = exchangePairs([
      { slug: 'a', seeks: ['financial'], offers: ['living'] },
      { slug: 'b', seeks: ['wisdom'], offers: ['social'] },
      { slug: 'c', seeks: ['living'], offers: ['financial'] },
    ]);
    expect(pairs.map((pair) => [pair.left.slug, pair.right.slug])).toEqual([
      ['a', 'c'],
    ]);
  });
});
