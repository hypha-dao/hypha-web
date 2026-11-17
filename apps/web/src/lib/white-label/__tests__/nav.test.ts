import { describe, expect, it } from 'vitest';

import { WL_TABS, showsTabBar, visibleNavKeys, type NavAvailability } from '..';

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
