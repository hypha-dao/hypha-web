import type { Locale } from '@hypha-platform/i18n';
import { getActiveTabFromPath } from './get-active-tab-from-path';
import { getDhoPathEnergy } from './get-path-function';

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
  lang: Locale | string;
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
    {
      key: 'overview',
      href: sectionHref(lang, spaceSlug, 'overview'),
      active: isActive('overview'),
      group: 'primary',
    },
    {
      key: 'agreements',
      href: sectionHref(lang, spaceSlug, 'agreements'),
      active: isActive('agreements'),
      group: 'primary',
    },
    {
      key: 'members',
      href: sectionHref(lang, spaceSlug, 'members'),
      active: isActive('members'),
      group: 'primary',
    },
    {
      key: 'treasury',
      href: sectionHref(lang, spaceSlug, 'treasury'),
      active: isActive('treasury'),
      group: 'primary',
    },
    {
      key: 'calendar',
      href: sectionHref(lang, spaceSlug, 'calendar'),
      active: isActive('calendar'),
      group: 'primary',
    },
  ];

  if (coherenceEnabled) {
    items.push({
      key: 'coherence',
      href: sectionHref(lang, spaceSlug, 'coherence'),
      active: isActive('coherence'),
      group: 'more',
    });
  }

  if (pipelineEnabled) {
    items.push({
      key: 'pipeline',
      href: sectionHref(lang, spaceSlug, 'pipeline'),
      active: isActive('pipeline'),
      group: 'more',
    });
  }

  if (energyEnabled) {
    items.push({
      key: 'energy',
      href: getDhoPathEnergy(lang as Locale, spaceSlug),
      active: isActive('energy'),
      group: 'more',
    });
  }

  items.push({
    key: 'rewards',
    href: sectionHref(lang, spaceSlug, 'rewards'),
    active: isActive('rewards'),
    group: 'more',
  });

  if (memoryEnabled) {
    items.push({
      key: 'memory',
      href: sectionHref(lang, spaceSlug, 'memory'),
      active: isActive('memory'),
      group: 'more',
    });
  }

  if (bankingEnabled) {
    items.push({
      key: 'banking',
      href: sectionHref(lang, spaceSlug, 'banking'),
      active: isActive('banking'),
      group: 'more',
    });
  }

  items.push({
    key: 'ecosystem-navigation',
    href: sectionHref(lang, spaceSlug, 'ecosystem-navigation'),
    active: isActive('ecosystem-navigation'),
    group: 'more',
  });

  return items;
}
