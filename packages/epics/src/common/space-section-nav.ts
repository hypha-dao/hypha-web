import { getActiveTabFromPath } from './get-active-tab-from-path';
import {
  normalizeSpaceScreenLayout,
  type SpaceScreenLayoutInput,
  type SpaceScreenLayoutKey,
} from '@hypha-platform/core/space/screen-layout';

export type SpaceSectionNavKey =
  | 'overview'
  | 'agreements'
  | 'quests'
  | 'members'
  | 'treasury'
  | 'calendar'
  | 'coherence'
  | 'pipeline'
  | 'energy'
  | 'rewards'
  | 'memory'
  | 'context'
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
  quests: 'primary',
  treasury: 'primary',
  memory: 'primary',
  context: 'primary',
  pipeline: 'primary',
  calendar: 'primary',
  'ecosystem-navigation': 'more',
  energy: 'primary',
  rewards: 'more',
};

/** These screens live on the space dashboard. The menu keeps Overview selected there. */
const HOME_DASHBOARD_TABS = new Set<string>([
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
  /** Saved order and hidden screens. Pipeline visibility follows `pipelineEnabled`. */
  screenLayout?: SpaceScreenLayoutInput | null;
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
 * An energy community keeps Energy directly under Overview unless the space
 * saved another order. Default menu:
 * Overview · Energy (when on) · Context · Signals · Calendar · Quests · Pipeline (when on) · Agreements · Treasury · Members · Memory
 * Rewards and ecosystem stay on the space dashboard.
 */
export function buildSpaceSectionNavItems({
  lang,
  spaceSlug,
  pathname,
  pipelineEnabled = false,
  energyEnabled = false,
  coherenceEnabled = true,
  memoryEnabled = false,
  screenLayout = null,
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
  const layout = normalizeSpaceScreenLayout(screenLayout);
  const hidden = new Set(layout.hidden);

  const available = (key: SpaceScreenLayoutKey): boolean => {
    if (hidden.has(key)) return false;
    switch (key) {
      case 'energy':
        return energyEnabled;
      case 'coherence':
        return coherenceEnabled;
      case 'pipeline':
        return pipelineEnabled;
      case 'memory':
        return memoryEnabled;
      default:
        return true;
    }
  };

  const items: SpaceSectionNavItem[] = [];
  for (const key of layout.order) {
    if (!available(key)) continue;
    const item = navItem(key, lang, spaceSlug, isActive(key));
    if (key === 'overview' && energyEnabled) {
      item.href = `${item.href}?${SPACE_DASHBOARD_BOARD_PARAM}=${SPACE_DASHBOARD_BOARD_VALUE}`;
    }
    items.push(item);
  }

  return items;
}

/**
 * Partition space section nav for the main tab strip.
 *
 * Primary tabs stay fixed from {@link SPACE_SECTION_NAV_GROUP}:
 * Overview, Energy, Context, Signals, Calendar, Quests, Pipeline, Agreements, Treasury, Members, and Memory.
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
