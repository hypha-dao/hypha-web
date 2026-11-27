import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SPACE_SCREEN_ORDER,
  moveVisibleSpaceScreen,
  normalizeSpaceScreenLayout,
  resolveSpaceScreenOrder,
  setSpaceScreenHidden,
  spaceScreenEditorKeys,
} from '../screen-layout';

describe('resolveSpaceScreenOrder', () => {
  it('uses the default order when nothing is saved', () => {
    expect(resolveSpaceScreenOrder(undefined)).toEqual([
      ...DEFAULT_SPACE_SCREEN_ORDER,
    ]);
    expect(resolveSpaceScreenOrder([])).toEqual([
      ...DEFAULT_SPACE_SCREEN_ORDER,
    ]);
  });

  it('keeps a saved order and slots missing screens back into the default sequence', () => {
    expect(resolveSpaceScreenOrder(['members', 'overview'])).toEqual([
      'members',
      'overview',
      'energy',
      'context',
      'coherence',
      'quests',
      'pipeline',
      'agreements',
      'treasury',
      'memory',
    ]);
  });

  it('drops unknown keys and duplicates', () => {
    expect(
      resolveSpaceScreenOrder(['overview', 'overview', 'nope', 'quests']),
    ).toEqual([
      'overview',
      'energy',
      'context',
      'coherence',
      'quests',
      'pipeline',
      'agreements',
      'treasury',
      'members',
      'memory',
    ]);
  });
});

describe('normalizeSpaceScreenLayout', () => {
  it('never hides overview or pipeline', () => {
    expect(
      normalizeSpaceScreenLayout({
        hidden: ['overview', 'pipeline', 'agreements', 'agreements', 'nope'],
      }).hidden,
    ).toEqual(['agreements']);
  });
});

describe('spaceScreenEditorKeys', () => {
  it('lists pipeline even when energy and memory are off', () => {
    expect(
      spaceScreenEditorKeys({
        energyEnabled: false,
        memoryEnabled: false,
      }),
    ).toEqual([
      'overview',
      'context',
      'coherence',
      'quests',
      'pipeline',
      'agreements',
      'treasury',
      'members',
    ]);
  });
});

describe('moveVisibleSpaceScreen', () => {
  it('reorders visible screens and leaves gated screens in place', () => {
    const next = moveVisibleSpaceScreen(
      DEFAULT_SPACE_SCREEN_ORDER,
      spaceScreenEditorKeys({
        order: DEFAULT_SPACE_SCREEN_ORDER,
        energyEnabled: false,
        memoryEnabled: false,
      }),
      'context',
      -1,
    );
    expect(next.slice(0, 4)).toEqual([
      'context',
      'energy',
      'overview',
      'coherence',
    ]);
  });
});

describe('setSpaceScreenHidden', () => {
  it('hides and shows a screen without touching overview', () => {
    const hidden = setSpaceScreenHidden([], 'treasury', true);
    expect(hidden).toEqual(['treasury']);
    expect(setSpaceScreenHidden(hidden, 'treasury', false)).toEqual([]);
    expect(setSpaceScreenHidden([], 'overview', true)).toEqual([]);
  });
});
