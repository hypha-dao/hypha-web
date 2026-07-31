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
  | 'banking'
  | 'ecosystem-navigation';

export type SpaceSectionNavGroup = 'primary' | 'more';

/** Primary strip vs overflow “More” — features preserved under More. */
export const SPACE_SECTION_NAV_GROUP: Record<
  SpaceSectionNavKey,
  SpaceSectionNavGroup
> = {
  overview: 'primary',
  agreements: 'primary',
  members: 'primary',
  treasury: 'primary',
  calendar: 'primary',
  coherence: 'more',
  pipeline: 'more',
  energy: 'more',
  rewards: 'more',
  memory: 'more',
  banking: 'more',
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
  /** Banking tab — included in More by default. */
  bankingEnabled?: boolean;
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
 */
export function buildSpaceSectionNavItems({
  lang,
  spaceSlug,
  pathname,
  pipelineEnabled = false,
  energyEnabled = false,
  coherenceEnabled = true,
  memoryEnabled = false,
  bankingEnabled = true,
}: BuildSpaceSectionNavItemsOptions): SpaceSectionNavItem[] {
  const activeTab = getActiveTabFromPath(pathname);
  const isActive = (key: SpaceSectionNavKey) => activeTab === key;

  const items: SpaceSectionNavItem[] = [
    navItem('overview', lang, spaceSlug, isActive('overview')),
    navItem('agreements', lang, spaceSlug, isActive('agreements')),
    navItem('members', lang, spaceSlug, isActive('members')),
    navItem('treasury', lang, spaceSlug, isActive('treasury')),
    navItem('calendar', lang, spaceSlug, isActive('calendar')),
  ];

  if (coherenceEnabled) {
    items.push(navItem('coherence', lang, spaceSlug, isActive('coherence')));
  }
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
  if (bankingEnabled) {
    items.push(navItem('banking', lang, spaceSlug, isActive('banking')));
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
