import { WL_TABS } from './constants';
import type { Tab } from './types';

const KNOWN: readonly string[] = WL_TABS;

/**
 * Keeps the known tab ids of a list, in the list's order, without duplicates.
 * Pure; the parsers of the config and of the request header share it.
 */
export function knownTabs(values: readonly unknown[]): Tab[] {
  return [
    ...new Set(
      values.filter(
        (value): value is Tab =>
          typeof value === 'string' && KNOWN.includes(value),
      ),
    ),
  ];
}

/**
 * True when `section` is shown for a client's `tabs` (absent means all). A
 * section that is not a tab is not decided here (returns true), except
 * `banking`, which follows `treasury`.
 */
export function isTabVisible(
  tabs: readonly Tab[] | undefined,
  section: string,
): boolean {
  if (tabs === undefined) return true;
  const tab = section === 'banking' ? 'treasury' : section;
  if (!KNOWN.includes(tab)) return true;
  return (tabs as readonly string[]).includes(tab);
}

/** The landing tab: the first listed (the first in product order for all). */
export function landingTab(tabs: readonly Tab[] | undefined): Tab {
  return tabs?.[0] ?? WL_TABS[0];
}
