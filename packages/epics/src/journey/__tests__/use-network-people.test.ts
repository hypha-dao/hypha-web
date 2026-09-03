import { describe, expect, it } from 'vitest';
import {
  networkPeopleCacheKey,
  personAvatarUrl,
  toNetworkPerson,
} from '../network-people';

describe('toNetworkPerson', () => {
  it('keeps people visible when networkVisible is omitted', () => {
    expect(
      toNetworkPerson({
        id: 1,
        slug: 'ada',
        name: 'Ada',
        surname: 'Lovelace',
      }),
    ).toEqual({
      id: 1,
      slug: 'ada',
      name: 'Ada Lovelace',
      avatarUrl: null,
      networkVisible: true,
    });
  });

  it('hides an explicit opt-out', () => {
    expect(
      toNetworkPerson({
        slug: 'hidden',
        name: 'Hidden',
        networkVisible: false,
      }),
    ).toBeNull();
  });

  it('uses avatarUrl, then avatar, then image', () => {
    expect(
      personAvatarUrl({ slug: 'a', avatarUrl: '/a.png', avatar: '/b.png' }),
    ).toBe('/a.png');
    expect(personAvatarUrl({ slug: 'a', avatar: ' /b.png ' })).toBe('/b.png');
    expect(personAvatarUrl({ slug: 'a', image: '/c.png' })).toBe('/c.png');
    expect(
      toNetworkPerson({ slug: 'lin', name: 'Lin', image: '/lin.png' }),
    ).toMatchObject({
      slug: 'lin',
      avatarUrl: '/lin.png',
    });
  });

  it('drops people without a slug', () => {
    expect(
      toNetworkPerson({ name: 'No Slug', avatarUrl: '/x.png' }),
    ).toBeNull();
  });
});

describe('networkPeopleCacheKey', () => {
  it('still fetches when there are no PUBLIC space slugs', () => {
    expect(
      networkPeopleCacheKey({
        awaitingAuth: false,
        spaceSlugs: [],
        excludeSlug: 'me',
        pageSize: 40,
      }),
    ).toEqual(['network-people', '', 'me', '40']);
  });

  it('waits for auth instead of treating it as an empty directory', () => {
    expect(
      networkPeopleCacheKey({
        awaitingAuth: true,
        spaceSlugs: ['garden'],
        pageSize: 40,
      }),
    ).toBeNull();
  });
});
