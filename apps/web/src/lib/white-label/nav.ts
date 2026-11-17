import { WL_TABS } from './constants';
import { landingTab } from './tabs';
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
export function isTabAvailable(tab: Tab, available: NavAvailability): boolean {
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
}

export function visibleNavKeys(
  tabs: readonly Tab[] | undefined,
  available: NavAvailability,
): Tab[] {
  const offered: readonly Tab[] = tabs ?? WL_TABS;
  return offered.filter((tab) => isTabAvailable(tab, available));
}

/**
 * Where a visitor on the bare path should go when the landing tab (the first
 * the client lists) is one this Space cannot serve: the first listed tab it
 * can. `null` when the landing is served, or when no listed tab is (nothing
 * better to show, the page stays as it is).
 */
export function landingFallback(
  tabs: readonly Tab[] | undefined,
  available: NavAvailability,
): Tab | null {
  if (isTabAvailable(landingTab(tabs), available)) return null;
  return visibleNavKeys(tabs, available)[0] ?? null;
}

/**
 * The bar is shown only when there is something to choose between: with one
 * visible tab (or none) there is no bar.
 */
export function showsTabBar(keys: readonly Tab[]): boolean {
  return keys.length > 1;
}
