import { getActiveTabFromPath } from './get-active-tab-from-path';

export type SpaceSectionNavKey =
  | 'overview'
  | 'agreements'
  | 'members'
  | 'treasury'
  | 'calendar'
  | 'coherence'
  | 'pipeline'
  | 'energy'
  | 'rewards'
  | 'memory'
  | 'ecosystem-navigation';

export type SpaceSectionNavGroup = 'primary' | 'more';

/** Primary strip vs overflow “More” — features preserved under More. */
export const SPACE_SECTION_NAV_GROUP: Record<
  SpaceSectionNavKey,
  SpaceSectionNavGroup
> = {
  overview: 'primary',
  coherence: 'primary',
  agreements: 'primary',
  treasury: 'primary',
  memory: 'primary',
  'ecosystem-navigation': 'more',
  calendar: 'more',
  members: 'more',
  pipeline: 'more',
  energy: 'more',
  rewards: 'more',
};

/** These screens live on the space home. The menu keeps Home selected there. */
const HOME_DASHBOARD_TABS = new Set<string>([
  'calendar',
  'members',
  'rewards',
  'energy',
  'ecosystem-navigation',
  'pipeline',
]);

export type SpaceSectionNavItem = {
  key: SpaceSectionNavKey;
  href: string;
  active: boolean;
  group: SpaceSectionNavGroup;
};

export type BuildSpaceSectionNavItemsOptions = {
  lang: string;
  spaceSlug: string;
  pathname: string;
  pipelineEnabled?: boolean;
  energyEnabled?: boolean;
  /** When false, Signals/Coherence is omitted. Default true for AI rail parity. */
  coherenceEnabled?: boolean;
  memoryEnabled?: boolean;
};

function sectionHref(lang: string, spaceSlug: string, section: string): string {
  return `/${lang}/dho/${spaceSlug}/${section}`;
}

function navItem(
  key: SpaceSectionNavKey,
  lang: string,
  spaceSlug: string,
  active: boolean,
): SpaceSectionNavItem {
  return {
    key,
    href: sectionHref(lang, spaceSlug, key),
    active,
    group: SPACE_SECTION_NAV_GROUP[key],
  };
}

/**
 * Canonical space section links for main-column tabs and AI left rail.
 * Flag/space gates omit items; destinations stay route-compatible.
 *
 * Menu: Home · Signals · Agreements · Treasury · Space memory
 * Calendar, members, rewards, ecosystem, and energy stay on the home dashboard.
 */
export function buildSpaceSectionNavItems({
  lang,
  spaceSlug,
  pathname,
  coherenceEnabled = true,
  memoryEnabled = false,
}: BuildSpaceSectionNavItemsOptions): SpaceSectionNavItem[] {
  const rawActiveTab = getActiveTabFromPath(pathname);
  // Banking lives under Treasury. Dashboard sections keep Home selected.
  const activeTab =
    rawActiveTab === 'banking'
      ? 'treasury'
      : HOME_DASHBOARD_TABS.has(rawActiveTab)
      ? 'overview'
      : rawActiveTab;
  const isActive = (key: SpaceSectionNavKey) => activeTab === key;

  const items: SpaceSectionNavItem[] = [
    navItem('overview', lang, spaceSlug, isActive('overview')),
  ];

  if (coherenceEnabled) {
    items.push(navItem('coherence', lang, spaceSlug, isActive('coherence')));
  }

  items.push(
    navItem('agreements', lang, spaceSlug, isActive('agreements')),
    navItem('treasury', lang, spaceSlug, isActive('treasury')),
  );

  if (memoryEnabled) {
    items.push(navItem('memory', lang, spaceSlug, isActive('memory')));
  }

  return items;
}

/**
 * Partition space section nav for the main tab strip.
 *
 * Primary tabs stay fixed from {@link SPACE_SECTION_NAV_GROUP}:
 * Home, Signals, Agreements, Treasury, and Space memory.
 */
export function partitionSpaceSectionNavForTabs(items: SpaceSectionNavItem[]): {
  primary: SpaceSectionNavItem[];
  more: SpaceSectionNavItem[];
} {
  const withDefaultGroups = items.map((item) => ({
    ...item,
    group: SPACE_SECTION_NAV_GROUP[item.key],
  }));

  return {
    primary: withDefaultGroups.filter((item) => item.group === 'primary'),
    more: withDefaultGroups.filter((item) => item.group === 'more'),
  };
}
