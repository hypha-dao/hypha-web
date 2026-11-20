import { describe, expect, it } from 'vitest';

import {
  isMemberCommunityPath,
  isMemberEnergyPath,
  isMemberSpaceHomePath,
  memberCommunityHref,
  memberCommunitySectionKey,
  memberEnergyHref,
  memberSpaceHomeHref,
  pickMemberFocusSpaceSlug,
} from '../member-mobile-nav';

describe('member mobile nav', () => {
  it('keeps the open space, then the latest membership, then the first space', () => {
    expect(
      pickMemberFocusSpaceSlug({
        pathSlug: 'open',
        recentSlugs: ['recent'],
        membershipSlugs: ['first'],
      }),
    ).toBe('open');
    expect(
      pickMemberFocusSpaceSlug({
        pathSlug: null,
        recentSlugs: ['old', 'recent'],
        membershipSlugs: ['recent', 'other'],
        membershipsLoaded: true,
      }),
    ).toBe('recent');
    expect(
      pickMemberFocusSpaceSlug({
        pathSlug: null,
        recentSlugs: ['left'],
        membershipSlugs: ['first', 'second'],
        membershipsLoaded: true,
      }),
    ).toBe('first');
    expect(
      pickMemberFocusSpaceSlug({
        pathSlug: null,
        recentSlugs: ['recent'],
        membershipSlugs: [],
      }),
    ).toBe('recent');
    expect(
      pickMemberFocusSpaceSlug({
        pathSlug: null,
        recentSlugs: ['left'],
        membershipSlugs: [],
        membershipsLoaded: true,
      }),
    ).toBe(null);
  });

  it('points Energy and Community at the focused space', () => {
    expect(memberEnergyHref('en', 'rue-verte')).toBe(
      '/en/dho/rue-verte/energy',
    );
    expect(memberCommunityHref('en', 'rue-verte')).toBe(
      '/en/dho/rue-verte/coherence',
    );
    expect(memberEnergyHref('en', null)).toBe('/en/home');
  });

  it('treats Energy as its own tab and the other space screens as Community', () => {
    expect(isMemberEnergyPath('/en/dho/rue-verte/energy')).toBe(true);
    expect(isMemberCommunityPath('/en/dho/rue-verte/energy')).toBe(false);
    expect(isMemberCommunityPath('/en/dho/rue-verte/coherence')).toBe(true);
    expect(isMemberCommunityPath('/en/dho/rue-verte')).toBe(false);
    expect(isMemberCommunityPath('/en/dho/rue-verte/overview')).toBe(false);
    expect(
      isMemberSpaceHomePath('/en/dho/rue-verte/overview', 'rue-verte'),
    ).toBe(true);
    expect(memberSpaceHomeHref('en', 'rue-verte')).toBe(
      '/en/dho/rue-verte/overview',
    );
    expect(isMemberCommunityPath('/en/home')).toBe(false);
    expect(memberCommunitySectionKey('/en/dho/rue-verte/agreements')).toBe(
      'agreements',
    );
    expect(memberCommunitySectionKey('/en/dho/rue-verte/banking')).toBe(
      'treasury',
    );
    expect(memberCommunitySectionKey('/en/dho/rue-verte/overview')).toBe(null);
  });
});
