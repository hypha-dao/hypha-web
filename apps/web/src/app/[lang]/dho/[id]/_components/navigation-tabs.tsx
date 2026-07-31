'use client';

import * as React from 'react';
import { Locale } from '@hypha-platform/i18n';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { cn } from '@hypha-platform/ui-utils';
import {
  SPACE_SECTION_NAV_ICONS,
  buildSpaceSectionNavItems,
  getActiveTabFromPath,
  type SpaceSectionNavKey,
  useMainColumnScrollY,
  useSpaceEnergy,
} from '@hypha-platform/epics';
import { useSpaceBySlug } from '@hypha-platform/core/client';

/** Subtle scroll parallax: tab strip drifts slightly vs page for depth. */
const TAB_PARALLAX_SCROLL_RATE = 0.07;
const TAB_PARALLAX_MAX_SHIFT_PX = 18;

function clampTabParallaxScrollY(scrollY: number): number {
  return Math.min(
    TAB_PARALLAX_MAX_SHIFT_PX,
    Math.max(-TAB_PARALLAX_MAX_SHIFT_PX, scrollY * TAB_PARALLAX_SCROLL_RATE),
  );
}

function isReducedMotionPreferred(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );
}

export function NavigationTabs({
  lang,
  id,
  coherenceEnabled = false,
  memoryEnabled = false,
}: {
  lang: Locale;
  id: string;
  /** When true, show the Coherence tab (from `getEnableCoherence()` on the server). */
  coherenceEnabled?: boolean;
  memoryEnabled?: boolean;
}) {
  const t = useTranslations('Common');
  const tNav = useTranslations('SelectNavigationAction');
  const tTreasury = useTranslations('TreasuryTab');
  const tCoherence = useTranslations('CoherenceTab');
  const pathname = usePathname();
  const activeTab = React.useMemo(
    () => getActiveTabFromPath(pathname),
    [pathname],
  );
  const { data: spaceEnergy } = useSpaceEnergy();
  const { space } = useSpaceBySlug(id);

  const mainScrollY = useMainColumnScrollY();
  const [preferReducedMotion, setPreferReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;

    const sync = () => {
      setPreferReducedMotion(mq.matches);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const tabParallaxY =
    preferReducedMotion || isReducedMotionPreferred()
      ? 0
      : clampTabParallaxScrollY(mainScrollY);

  const labelFor = React.useCallback(
    (key: SpaceSectionNavKey): string => {
      switch (key) {
        case 'overview':
          return t('home');
        case 'agreements':
          return t('Agreements');
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
    },
    [t, tNav, tTreasury, tCoherence],
  );

  const items = React.useMemo(
    () =>
      buildSpaceSectionNavItems({
        lang,
        spaceSlug: id,
        pathname,
        pipelineEnabled: Boolean(space?.pipelineEnabled),
        energyEnabled: Boolean(spaceEnergy?.enabled),
        coherenceEnabled,
        memoryEnabled,
      }),
    [
      coherenceEnabled,
      id,
      lang,
      memoryEnabled,
      pathname,
      space?.pipelineEnabled,
      spaceEnergy?.enabled,
    ],
  );

  const primary = items.filter((i) => i.group === 'primary');
  const more = items.filter((i) => i.group === 'more');
  const moreActive = more.some((i) => i.active);
  // Banking is under Treasury — highlight Treasury on /banking routes.
  const stripActiveTab = activeTab === 'banking' ? 'treasury' : activeTab;
  const tabsValue = moreActive ? 'more' : stripActiveTab;

  return (
    <Tabs value={tabsValue} className="mt-4 w-full md:mt-5">
      <div
        className={cn(
          'mb-3 w-full overflow-x-auto overflow-y-visible overscroll-x-contain py-2',
          'touch-pan-x touch-pan-y [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        <TabsList
          className="flex h-10 min-w-max will-change-transform gap-0.5 md:min-w-0 md:w-full"
          style={
            preferReducedMotion
              ? undefined
              : { transform: `translate3d(0, ${tabParallaxY}px, 0)` }
          }
        >
          {primary.map(({ key, href }) => {
            const Icon = SPACE_SECTION_NAV_ICONS[key];
            return (
              <TabsTrigger asChild key={key} value={key} variant="ghost">
                <Link
                  href={href}
                  className="flex w-full items-center justify-center gap-1.5"
                >
                  <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  {labelFor(key)}
                </Link>
              </TabsTrigger>
            );
          })}
          {more.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  colorVariant="neutral"
                  className={cn(
                    'h-10 shrink-0 gap-1 px-3 text-2 font-medium',
                    moreActive && 'bg-muted text-foreground',
                  )}
                  aria-label={t('moreNav')}
                >
                  {t('moreNav')}
                  <ChevronDown className="size-3.5 opacity-70" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-48">
                {more.map(({ key, href, active }) => {
                  const Icon = SPACE_SECTION_NAV_ICONS[key];
                  return (
                    <DropdownMenuItem key={key} asChild>
                      <Link
                        href={href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex cursor-pointer items-center gap-2',
                          active && 'bg-accent-3 text-accent-12',
                        )}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        {labelFor(key)}
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </TabsList>
      </div>
    </Tabs>
  );
}
