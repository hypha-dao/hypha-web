import { describe, expect, it } from 'vitest';

import {
  WL_TABS,
  landingFallback,
  sectionSegment,
  showsTabBar,
  visibleNavKeys,
  type NavAvailability,
} from '..';

const NONE: NavAvailability = {
  energy: false,
  coherence: false,
  pipeline: false,
  memory: false,
};
const ALL: NavAvailability = {
  energy: true,
  coherence: true,
  pipeline: true,
  memory: true,
};

describe('visibleNavKeys', () => {
  it('all tabs: the product order, minus what the Space cannot serve', () => {
    expect(visibleNavKeys(undefined, ALL)).toEqual([...WL_TABS]);
    // Today\'s menu for a plain Space: energy, signals, pipeline, memory out.
    expect(visibleNavKeys(undefined, NONE)).toEqual([
      'overview',
      'agreements',
      'members',
      'treasury',
      'calendar',
      'rewards',
      'ecosystem-navigation',
    ]);
  });

  it('energy sits second when on, as the menu always had it', () => {
    expect(
      visibleNavKeys(undefined, { ...NONE, energy: true }).slice(0, 3),
    ).toEqual(['overview', 'energy', 'agreements']);
  });

  it('a client list: its order, only its tabs', () => {
    expect(visibleNavKeys(['members', 'overview', 'calendar'], NONE)).toEqual([
      'members',
      'overview',
      'calendar',
    ]);
  });

  it('a listed tab the Space cannot serve is simply not shown', () => {
    expect(
      visibleNavKeys(['energy', 'pipeline', 'members', 'memory'], NONE),
    ).toEqual(['members']);
    expect(
      visibleNavKeys(['energy', 'pipeline', 'members', 'memory'], ALL),
    ).toEqual(['energy', 'pipeline', 'members', 'memory']);
  });

  it('the Pipeline item needs the client list and the Space', () => {
    expect(visibleNavKeys(['members'], ALL)).toEqual(['members']);
    expect(visibleNavKeys(['pipeline', 'members'], NONE)).toEqual(['members']);
  });
});

describe('showsTabBar', () => {
  it('one visible tab or none: no bar', () => {
    expect(showsTabBar([])).toBe(false);
    expect(showsTabBar(['overview'])).toBe(false);
    expect(showsTabBar(['overview', 'members'])).toBe(true);
  });
});

describe('landing fallback', () => {
  const none = {
    energy: false,
    coherence: true,
    pipeline: false,
    memory: true,
  };
  const all = { energy: true, coherence: true, pipeline: true, memory: true };

  it('the landing is served: nothing to do', () => {
    expect(landingFallback(['energy', 'members'], all)).toBeNull();
    expect(landingFallback(['members', 'energy'], none)).toBeNull();
    expect(landingFallback(undefined, none)).toBeNull();
  });

  it('the landing is not served: the first listed tab that is', () => {
    expect(landingFallback(['energy', 'members', 'treasury'], none)).toBe(
      'members',
    );
    expect(landingFallback(['energy', 'pipeline', 'treasury'], none)).toBe(
      'treasury',
    );
  });

  it('no listed tab is served: stay (null)', () => {
    expect(landingFallback(['energy', 'pipeline'], none)).toBeNull();
  });
});

describe('sectionSegment', () => {
  const frame = { mode: 'embed', spaceSlug: 's1', lang: 'en' } as const;
  const host = {
    mode: 'host',
    spaceSlug: 's1',
    lang: 'en',
    fullAppOrigin: 'https://app.example',
  } as const;

  it('bare paths name no section', () => {
    for (const p of ['/embed/s1', '/embed/s1/en', '/embed/s1/en/']) {
      expect(sectionSegment(frame, p), p).toBeUndefined();
    }
    for (const p of ['/', '/en']) {
      expect(sectionSegment(host, p), p).toBeUndefined();
    }
  });

  it('a path that names a section returns it', () => {
    expect(sectionSegment(frame, '/embed/s1/en/members')).toBe('members');
    expect(sectionSegment(frame, '/embed/s1/members')).toBe('members');
    expect(sectionSegment(host, '/en/energy')).toBe('energy');
    expect(sectionSegment(host, '/members')).toBe('members');
  });
});
