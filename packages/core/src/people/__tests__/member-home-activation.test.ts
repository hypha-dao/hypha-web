import { describe, expect, it } from 'vitest';

import { memberHomeSpacesAboutToExpire } from '../member-home-activation';

const space = {
  slug: 'grove',
  title: 'Grove',
  web3SpaceId: 4,
  hasSpacePaid: true,
  freeTrialUsed: true,
  daysLeft: 6,
};

describe('memberHomeSpacesAboutToExpire', () => {
  it('keeps a paid space inside the last two weeks', () => {
    expect(memberHomeSpacesAboutToExpire([space])).toEqual([
      {
        slug: 'grove',
        title: 'Grove',
        web3SpaceId: 4,
        daysLeft: 6,
      },
    ]);
  });

  it('keeps a trial that is inside the same window', () => {
    expect(
      memberHomeSpacesAboutToExpire([
        { ...space, hasSpacePaid: false, daysLeft: 2 },
      ]).map((item) => item.daysLeft),
    ).toEqual([2]);
  });

  it('leaves out a space with time remaining and one already ended', () => {
    expect(
      memberHomeSpacesAboutToExpire([
        { ...space, slug: 'later', daysLeft: 40 },
        { ...space, slug: 'ended', daysLeft: 0 },
        { ...space, slug: 'unstarted', freeTrialUsed: false, daysLeft: 3 },
      ]),
    ).toEqual([]);
  });

  it('puts the soonest space first', () => {
    expect(
      memberHomeSpacesAboutToExpire([
        { ...space, slug: 'later', daysLeft: 12 },
        { ...space, slug: 'soon', title: 'Soon', daysLeft: 1 },
      ]).map((item) => item.slug),
    ).toEqual(['soon', 'later']);
  });
});
