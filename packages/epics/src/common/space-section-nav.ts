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
  calendar: 'primary',
  members: 'more',
  pipeline: 'more',
  energy: 'more',
  rewards: 'more',
  memory: 'more',
  'ecosystem-navigation': 'more',
};

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
 * Primary order: Dashboard · Signals · Agreements · Treasury · Calendar
 * More: Members + remaining gated/secondary sections
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
  // Banking lives under Treasury — keep Treasury highlighted on /banking routes.
  const activeTab = rawActiveTab === 'banking' ? 'treasury' : rawActiveTab;
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
    navItem('calendar', lang, spaceSlug, isActive('calendar')),
    navItem('members', lang, spaceSlug, isActive('members')),
  );

  if (pipelineEnabled) {
    items.push(navItem('pipeline', lang, spaceSlug, isActive('pipeline')));
  }
  if (energyEnabled) {
    items.push(navItem('energy', lang, spaceSlug, isActive('energy')));
  }

  items.push(navItem('rewards', lang, spaceSlug, isActive('rewards')));

  if (memoryEnabled) {
    items.push(navItem('memory', lang, spaceSlug, isActive('memory')));
  }

  items.push(
    navItem(
      'ecosystem-navigation',
      lang,
      spaceSlug,
      isActive('ecosystem-navigation'),
    ),
  );

  return items;
}

/**
 * Partition space section nav for the main tab strip.
 *
 * Default primary/more grouping comes from {@link SPACE_SECTION_NAV_GROUP}.
 * When the active section defaults to More, promote it into the last primary
 * slot so the active section stays visible; the displaced primary item moves
 * into More. When the active key is already a default-primary item, restore
 * the default partition (no sticky promotion).
 */
export function partitionSpaceSectionNavForTabs(items: SpaceSectionNavItem[]): {
  primary: SpaceSectionNavItem[];
  more: SpaceSectionNavItem[];
} {
  const withDefaultGroups = items.map((item) => ({
    ...item,
    group: SPACE_SECTION_NAV_GROUP[item.key],
  }));

  const primaryDefaults = withDefaultGroups.filter(
    (i) => i.group === 'primary',
  );
  const moreDefaults = withDefaultGroups.filter((i) => i.group === 'more');
  const active = withDefaultGroups.find((i) => i.active);

  if (!active || active.group === 'primary') {
    return { primary: primaryDefaults, more: moreDefaults };
  }

  if (primaryDefaults.length === 0) {
    return {
      primary: [{ ...active, group: 'primary' }],
      more: moreDefaults.filter((i) => i.key !== active.key),
    };
  }

  const lastPrimary = primaryDefaults[primaryDefaults.length - 1]!;
  return {
    primary: [...primaryDefaults.slice(0, -1), { ...active, group: 'primary' }],
    more: [
      { ...lastPrimary, group: 'more' },
      ...moreDefaults.filter((i) => i.key !== active.key),
    ],
  };
}
