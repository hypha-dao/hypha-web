import { WL_TABS } from './constants';
import type { Tab } from './types';

/** What the Space decides about the tabs that exist only for some Spaces. */
export type NavAvailability = {
  /** The Space is an energy community. */
  energy: boolean;
  /** The Coherence (Signals) feature is on. */
  coherence: boolean;
  /** The Space has a pipeline and the visitor can read it (a member). */
  pipeline: boolean;
  /** The Space Memory feature is on. */
  memory: boolean;
};

/**
 * The tabs the menu shows: the client's `tabs` in the client's order (all in
 * product order when absent), minus the ones this Space cannot serve (energy,
 * signals, pipeline, memory). Pure. A listed tab the Space cannot serve is
 * simply not shown; nothing else changes.
 */
export function visibleNavKeys(
  tabs: readonly Tab[] | undefined,
  available: NavAvailability,
): Tab[] {
  const offered: readonly Tab[] = tabs ?? WL_TABS;
  return offered.filter((tab) => {
    switch (tab) {
      case 'energy':
        return available.energy;
      case 'coherence':
        return available.coherence;
      case 'pipeline':
        return available.pipeline;
      case 'memory':
        return available.memory;
      default:
        return true;
    }
  });
}

/**
 * The bar is shown only when there is something to choose between: with one
 * visible tab (or none) there is no bar.
 */
export function showsTabBar(keys: readonly Tab[]): boolean {
  return keys.length > 1;
}
