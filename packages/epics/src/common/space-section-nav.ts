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
  members: 'primary',
  agreements: 'primary',
  treasury: 'primary',
  memory: 'primary',
  pipeline: 'primary',
  'ecosystem-navigation': 'more',
  calendar: 'more',
  energy: 'primary',
  rewards: 'more',
};

/** These screens live on the space dashboard. The menu keeps Overview selected there. */
const HOME_DASHBOARD_TABS = new Set<string>([
  'calendar',
  'rewards',
  'ecosystem-navigation',
]);

/** Overview link that stays on the space dashboard inside an energy community. */
export const SPACE_DASHBOARD_BOARD_PARAM = 'board';
export const SPACE_DASHBOARD_BOARD_VALUE = 'space';

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
 * An energy community opens on Energy. Overview stays next to it so the space dashboard remains one step away.
 * Menu: Energy (when on) · Overview · Signals · Deals (when on) · Agreements · Members · Treasury · Space memory
 * Calendar, rewards, and ecosystem stay on the space dashboard.
 */
export function buildSpaceSectionNavItems({
  lang,
  spaceSlug,
  pathname,
  pipelineEnabled = false,
  energyEnabled = false,
  coherenceEnabled = true,
  memoryEnabled = false,
}: BuildSpaceSectionNavItemsOptions): SpaceSectionNavItem[] {
  const rawActiveTab = getActiveTabFromPath(pathname);
  // Banking lives under Treasury. Space-dashboard sections keep Overview selected.
  const activeTab =
    rawActiveTab === 'banking'
      ? 'treasury'
      : HOME_DASHBOARD_TABS.has(rawActiveTab)
      ? 'overview'
      : rawActiveTab;
  const isActive = (key: SpaceSectionNavKey) => activeTab === key;

  const items: SpaceSectionNavItem[] = [];

  if (energyEnabled) {
    items.push(navItem('energy', lang, spaceSlug, isActive('energy')));
  }

  const overview = navItem('overview', lang, spaceSlug, isActive('overview'));
  if (energyEnabled) {
    overview.href = `${overview.href}?${SPACE_DASHBOARD_BOARD_PARAM}=${SPACE_DASHBOARD_BOARD_VALUE}`;
  }
  items.push(overview);

  if (coherenceEnabled) {
    items.push(navItem('coherence', lang, spaceSlug, isActive('coherence')));
  }

  if (pipelineEnabled) {
    items.push(navItem('pipeline', lang, spaceSlug, isActive('pipeline')));
  }

  items.push(
    navItem('agreements', lang, spaceSlug, isActive('agreements')),
    navItem('members', lang, spaceSlug, isActive('members')),
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
 * Energy, Overview, Signals, Agreements, Members, Treasury, and Space memory.
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
