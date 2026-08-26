import { describe, expect, it } from 'vitest';
import {
  isNetworkSharedDiscoverability,
  selectNetworkPulseCandidates,
  spaceVisualsFromSpaces,
  storyContext,
  storyHref,
  uniquePeople,
} from '../network-pulse';

describe('network-pulse', () => {
  it('treats only public and network discoverability as shared', () => {
    expect(isNetworkSharedDiscoverability(0)).toBe(true);
    expect(isNetworkSharedDiscoverability(1)).toBe(true);
    expect(isNetworkSharedDiscoverability(2)).toBe(false);
    expect(isNetworkSharedDiscoverability(3)).toBe(false);
    expect(isNetworkSharedDiscoverability(undefined)).toBe(false);
  });

  it('skips sandbox, archived, and spaces without a network id', () => {
    const selected = selectNetworkPulseCandidates(
      [
        { slug: 'garden', web3SpaceId: 1, flags: [] },
        { slug: 'lab', web3SpaceId: 2, flags: ['sandbox'] },
        { slug: 'old', web3SpaceId: 3, flags: ['archived'] },
        { slug: 'ghost', flags: [] },
      ],
      10,
    );

    expect(selected.map((space) => space.slug)).toEqual(['garden']);
  });

  it('strips markup and shortens story context', () => {
    expect(storyContext('<p>Open kitchen  night</p>')).toBe(
      'Open kitchen night',
    );
    expect(storyContext('a'.repeat(160))?.endsWith('…')).toBe(true);
    expect(storyContext('   ')).toBeNull();
  });

  it('indexes space logos and lead images for story tiles', () => {
    expect(
      spaceVisualsFromSpaces([
        { slug: 'garden', logoUrl: '/garden.png', leadImage: '/garden.jpg' },
        { slug: null, logoUrl: '/skip.png' },
      ]),
    ).toEqual({
      garden: { logoUrl: '/garden.png', leadImage: '/garden.jpg' },
    });
  });

  it('links votes and signals into the space', () => {
    expect(
      storyHref('en', {
        id: 'vote:garden:1',
        kind: 'vote',
        title: 'Fund the kitchen',
        spaceSlug: 'garden',
        spaceTitle: 'Garden',
        targetSlug: 'proposal-1',
        context: null,
      }),
    ).toBe('/en/dho/garden/agreements/proposal/proposal-1');
    expect(
      storyHref('en', {
        id: 'signal:garden:2',
        kind: 'signal',
        title: 'Need extra hands',
        spaceSlug: 'garden',
        spaceTitle: 'Garden',
        targetSlug: 'need-hands',
        context: null,
      }),
    ).toBe('/en/dho/garden?signal=need-hands');
  });

  it('hides opted-out people from the network directory', () => {
    expect(
      uniquePeople(
        [
          { slug: 'ada', name: 'Ada', networkVisible: false },
          { slug: 'me', name: 'Me' },
          { slug: 'lin', name: 'Lin' },
        ],
        'me',
      ).map((person) => person.slug),
    ).toEqual(['lin']);
  });
});
