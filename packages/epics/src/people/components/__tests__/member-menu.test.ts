import { describe, expect, it } from 'vitest';

import {
  activeMemberMenuKey,
  buildMemberMenu,
  isCommunityMenuKey,
  memberMenuGroup,
  memberPersonalRedirect,
  resolveMemberSpaceSlug,
} from '../member-menu';

const base = {
  lang: 'en',
  spaceSlug: 'rue-verte',
  pathname: '/en/dho/rue-verte/overview',
  energyEnabled: true,
};

describe('buildMemberMenu', () => {
  it('keeps energy beside home only for an energy community', () => {
    const withEnergy = buildMemberMenu(base).map((item) => item.key);
    const withoutEnergy = buildMemberMenu({
      ...base,
      energyEnabled: false,
    }).map((item) => item.key);
    expect(withEnergy).toEqual([
      'home',
      'energy',
      'wallet',
      'messages',
      'signals',
      'decisions',
      'treasury',
      'members',
    ]);
    expect(withoutEnergy).not.toContain('energy');
  });

  it('splits you and community, and points home at the space', () => {
    const items = buildMemberMenu(base);
    expect(memberMenuGroup(items, 'you').map((item) => item.key)).toEqual([
      'home',
      'energy',
      'wallet',
      'messages',
    ]);
    expect(memberMenuGroup(items, 'community').map((item) => item.key)).toEqual(
      ['signals', 'decisions', 'treasury', 'members'],
    );
    expect(items.find((item) => item.key === 'home')?.href).toBe(
      '/en/dho/rue-verte/overview?board=space',
    );
    expect(items.find((item) => item.key === 'energy')?.href).toBe(
      '/en/dho/rue-verte/energy',
    );
    expect(items.find((item) => item.key === 'messages')?.href).toBe(
      '/en/messages?space=rue-verte',
    );
    expect(items.find((item) => item.key === 'decisions')?.href).toBe(
      '/en/dho/rue-verte/agreements',
    );
  });

  it('marks the screen that is open', () => {
    const items = buildMemberMenu({
      ...base,
      pathname: '/en/dho/rue-verte/treasury/banking',
    });
    expect(items.find((item) => item.active)?.key).toBe('treasury');
    expect(activeMemberMenuKey('/en/my-wallet')).toBe('wallet');
    expect(activeMemberMenuKey('/en/messages')).toBe('messages');
    expect(isCommunityMenuKey('signals')).toBe(true);
    expect(isCommunityMenuKey('home')).toBe(false);
  });
});

describe('resolveMemberSpaceSlug', () => {
  it('prefers the space in the URL, then a recent membership', () => {
    expect(
      resolveMemberSpaceSlug({
        pathSlug: 'canal',
        memberSlugs: ['rue-verte'],
        recentSlugs: ['rue-verte'],
      }),
    ).toBe('canal');
    expect(
      resolveMemberSpaceSlug({
        pathSlug: null,
        memberSlugs: ['rue-verte', 'canal'],
        recentSlugs: ['canal', 'rue-verte'],
      }),
    ).toBe('canal');
    expect(
      resolveMemberSpaceSlug({
        pathSlug: null,
        memberSlugs: ['rue-verte'],
        recentSlugs: [],
      }),
    ).toBe('rue-verte');
  });
});

describe('memberPersonalRedirect', () => {
  it('sends personal screens to the space and keeps wallet and space routes', () => {
    expect(
      memberPersonalRedirect({
        pathname: '/en/home',
        search: '',
        lang: 'en',
        spaceSlug: 'rue-verte',
      }),
    ).toBe('/en/dho/rue-verte/overview?board=space');
    expect(
      memberPersonalRedirect({
        pathname: '/en/network/exchange',
        search: '',
        lang: 'en',
        spaceSlug: 'rue-verte',
      }),
    ).toBe('/en/dho/rue-verte/overview?board=space');
    expect(
      memberPersonalRedirect({
        pathname: '/en/messages',
        search: '',
        lang: 'en',
        spaceSlug: 'rue-verte',
      }),
    ).toBe('/en/messages?space=rue-verte');
    expect(
      memberPersonalRedirect({
        pathname: '/en/messages',
        search: '?space=rue-verte',
        lang: 'en',
        spaceSlug: 'rue-verte',
      }),
    ).toBeNull();
    expect(
      memberPersonalRedirect({
        pathname: '/en/my-wallet',
        search: '',
        lang: 'en',
        spaceSlug: 'rue-verte',
      }),
    ).toBeNull();
    expect(
      memberPersonalRedirect({
        pathname: '/en/dho/rue-verte/energy',
        search: '',
        lang: 'en',
        spaceSlug: 'rue-verte',
      }),
    ).toBeNull();
  });
});
