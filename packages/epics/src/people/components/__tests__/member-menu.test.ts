import { describe, expect, it } from 'vitest';

import {
  memberSurfaceSpaceQuery,
  activeMemberMenuKey,
  buildMemberMenu,
  isCommunityMenuKey,
  memberMenuGroup,
  memberPersonalRedirect,
  resolveMemberSpaceSlug,
  spaceAskShortName,
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
    expect(items.find((item) => item.key === 'wallet')?.href).toBe(
      '/en/my-wallet?space=rue-verte',
    );
    expect(items.find((item) => item.key === 'messages')?.href).toBe(
      '/en/messages?space=rue-verte',
    );
    expect(items.find((item) => item.key === 'decisions')?.href).toBe(
      '/en/dho/rue-verte/agreements',
    );
  });

  it('keeps wallet and messages when the member has no space yet', () => {
    const items = buildMemberMenu({ ...base, spaceSlug: '' });
    expect(items.find((item) => item.key === 'wallet')?.href).toBe(
      '/en/my-wallet',
    );
    expect(items.find((item) => item.key === 'messages')?.href).toBe(
      '/en/messages',
    );
    expect(items.find((item) => item.key === 'home')?.href).toBe('');
    expect(items.find((item) => item.key === 'signals')?.href).toBe('');
  });

  it('marks the screen that is open', () => {
    const items = buildMemberMenu({
      ...base,
      pathname: '/en/dho/rue-verte/treasury/banking',
    });
    expect(items.find((item) => item.active)?.key).toBe('treasury');
    expect(activeMemberMenuKey('/en/my-wallet')).toBe('wallet');
    expect(activeMemberMenuKey('/en/messages')).toBe('messages');
    expect(activeMemberMenuKey('/en/dho/messages/agreements')).toBe(
      'decisions',
    );
    expect(activeMemberMenuKey('/en/dho/my-wallet/treasury')).toBe('treasury');
    expect(isCommunityMenuKey('signals')).toBe(true);
    expect(isCommunityMenuKey('home')).toBe(false);
  });
});

describe('memberSurfaceSpaceQuery', () => {
  it('reads a space slug on wallet and messages, and ignores a wallet action id', () => {
    expect(memberSurfaceSpaceQuery('/en/my-wallet', 'rue-verte')).toBe(
      'rue-verte',
    );
    expect(memberSurfaceSpaceQuery('/en/messages', 'rue-verte')).toBe(
      'rue-verte',
    );
    expect(
      memberSurfaceSpaceQuery('/en/my-wallet/actions/activate-spaces', '42'),
    ).toBeNull();
    expect(memberSurfaceSpaceQuery('/en/dho/rue-verte/overview', 'other')).toBe(
      null,
    );
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
    expect(
      resolveMemberSpaceSlug({
        pathSlug: null,
        querySlug: 'canal',
        memberSlugs: ['rue-verte', 'canal'],
        recentSlugs: ['rue-verte'],
      }),
    ).toBe('canal');
    expect(
      resolveMemberSpaceSlug({
        pathSlug: 'rue-verte',
        querySlug: 'canal',
        memberSlugs: ['rue-verte', 'canal'],
        recentSlugs: ['canal'],
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
    ).toBe('/en/my-wallet?space=rue-verte');
    expect(
      memberPersonalRedirect({
        pathname: '/en/my-wallet',
        search: '?space=rue-verte',
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

describe('spaceAskShortName', () => {
  it('uses the first word, skipping a leading article', () => {
    expect(spaceAskShortName('Hypha Flywheel')).toBe('Hypha');
    expect(spaceAskShortName('The Hypha Network')).toBe('Hypha');
    expect(spaceAskShortName('A Solar Collective')).toBe('Solar');
    expect(spaceAskShortName('An Open Commons')).toBe('Open');
    expect(spaceAskShortName('The')).toBe('The');
    expect(spaceAskShortName('')).toBe('');
  });
});
