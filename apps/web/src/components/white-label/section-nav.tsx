'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import {
  SPACE_DASHBOARD_BOARD_PARAM,
  SPACE_DASHBOARD_BOARD_VALUE,
  SPACE_SECTION_NAV_ICONS,
  useActionStatus,
  useSpaceEnergy,
  type SpaceSectionNavKey,
} from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';

import { sectionFromPathname, sectionHref } from '@web/lib/white-label/link';
import { showsTabBar, visibleNavKeys } from '@web/lib/white-label/nav';
import type { Tab } from '@web/lib/white-label/types';
import { useWhiteLabel } from './white-label-provider';

/**
 * Section menu of the white-label tree. Same sections as the main app's Space
 * menu, minus the ones that are not served (see the `wl` pages), with hrefs
 * under `/embed` or, on a mapped host, at the host root.
 */
export function WhiteLabelSectionNav({
  spaceSlug,
  coherenceEnabled,
  memoryEnabled,
}: {
  spaceSlug: string;
  coherenceEnabled: boolean;
  memoryEnabled: boolean;
}) {
  const ctx = useWhiteLabel();
  const pathname = usePathname() ?? '';
  const t = useTranslations('Common');
  const tNav = useTranslations('SelectNavigationAction');
  const tTreasury = useTranslations('TreasuryTab');
  const tCoherence = useTranslations('CoherenceTab');
  const { data: energy } = useSpaceEnergy(spaceSlug);
  const { space } = useSpaceBySlug(spaceSlug);
  // The pipeline is members only: on a delivery without login it never has data.
  const pipelineLive = useActionStatus('pipeline-data') === 'live';

  // The client's tabs in its order, minus what this Space cannot serve.
  const clientTabs = ctx?.tabs;
  const tabsKey = clientTabs?.join(',');
  const keys: Tab[] = React.useMemo(
    () =>
      visibleNavKeys(clientTabs, {
        energy: energy?.enabled === true,
        coherence: coherenceEnabled,
        pipeline: Boolean(space?.pipelineEnabled) && pipelineLive,
        memory: memoryEnabled,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      tabsKey,
      energy?.enabled,
      coherenceEnabled,
      space?.pipelineEnabled,
      pipelineLive,
      memoryEnabled,
    ],
  );

  // Energy communities open Overview on the energy dashboard; this flag keeps
  // the Space dashboard reachable, as in the main app's menu.
  const overviewSearch = keys.includes('energy')
    ? `?${SPACE_DASHBOARD_BOARD_PARAM}=${SPACE_DASHBOARD_BOARD_VALUE}`
    : '';

  const label = (key: SpaceSectionNavKey): string => {
    switch (key) {
      case 'overview':
        return t('overview');
      case 'agreements':
        return t('Agreements');
      case 'quests':
        return t('quests');
      case 'members':
        return t('Members');
      case 'treasury':
        return t('Treasury');
      case 'calendar':
        return t('Calendar');
      case 'coherence':
        return t('Signals');
      case 'pipeline':
        return t('Pipeline');
      case 'energy':
        return t('Energy');
      case 'rewards':
        return tTreasury('rewardsSection.title');
      case 'memory':
        return tCoherence('spaceMemory');
      case 'ecosystem-navigation':
        return tNav('ecosystem');
      default:
        return key;
    }
  };

  // One visible tab (or none): nothing to choose between, no bar.
  if (!ctx || !showsTabBar(keys)) return null;

  // /embed/<slug>[/<lang>][/<section>] or, on a mapped host, [/<lang>]/<section>.
  const active = sectionFromPathname(ctx, pathname);

  return (
    <nav
      aria-label={t('overview')}
      className="mt-4 w-full min-w-0 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ul className="flex min-w-max gap-0.5">
        {keys.map((key) => {
          const Icon = SPACE_SECTION_NAV_ICONS[key];
          const isActive = active === key;
          return (
            <li key={key}>
              <Link
                href={sectionHref(
                  ctx,
                  key,
                  key === 'overview' ? overviewSearch : '',
                )}
                scroll={false}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm [&_svg]:size-3.5 [&_svg]:shrink-0',
                  isActive
                    ? 'border-b-2 border-accent-9 font-medium text-foreground'
                    : 'text-neutral-11 hover:text-foreground',
                )}
              >
                <Icon className="craft-icon" strokeWidth={1.25} aria-hidden />
                {label(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
