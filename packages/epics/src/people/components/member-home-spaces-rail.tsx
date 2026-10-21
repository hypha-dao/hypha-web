'use client';

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type { Locale } from '@hypha-platform/i18n';
import type { MemberIntelligence } from '@hypha-platform/core/client';

import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { SPACES_RAIL_ID, useSpacesRailControl } from './spaces-rail-control';
import { HomeWave } from './member-home-wave';
import './member-home-spaces-rail.css';

type HomeSpace = MemberIntelligence['spaces'][number];

/** Compact spaces bar. Marks are 32px inside a 44px row or column. */
const RAIL_ICON = 32;

export function orderSpacesByRecentVisit<T extends { slug: string }>(
  spaces: readonly T[],
  recentSlugs: string[],
): T[] {
  if (spaces.length === 0) return [...spaces];
  const bySlug = new Map(spaces.map((space) => [space.slug, space]));
  const ordered: T[] = [];
  const seen = new Set<string>();

  for (const slug of recentSlugs) {
    const space = bySlug.get(slug);
    if (!space || seen.has(space.slug)) continue;
    ordered.push(space);
    seen.add(space.slug);
  }

  for (const space of spaces) {
    if (seen.has(space.slug)) continue;
    ordered.push(space);
    seen.add(space.slug);
  }

  return ordered;
}

export function MemberHomeSpacesRail({
  lang,
  spaces,
  isLoading,
  activeSlug,
  embedded = false,
  persistOnWide = false,
}: {
  lang: Locale;
  spaces: HomeSpace[];
  isLoading?: boolean;
  activeSlug?: string | null;
  /** Fill the left menu column instead of sitting as its own rail. */
  embedded?: boolean;
  /**
   * Home only. Below `xl` the column still follows the bottom menu.
   * On the wide layout, where that menu is gone, the column stays open.
   */
  persistOnWide?: boolean;
}) {
  const t = useTranslations('MemberHome');
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() =>
    readRecentSpaceSlugs(),
  );

  useEffect(() => subscribeRecentSpaceSlugs(setRecentSlugs), []);

  const orderedSpaces = useMemo(
    () => orderSpacesByRecentVisit(spaces, recentSlugs),
    [recentSlugs, spaces],
  );
  const canToggle = !embedded && (isLoading || orderedSpaces.length > 0);

  const rail = (rowOnNarrow: boolean) => (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t('spacesRail')}
        tabIndex={-1}
        className={cn(
          'narrow-scrollbar flex h-full min-h-0 w-full min-w-0 shrink-0 items-center gap-1 outline-none',
          rowOnNarrow
            ? 'member-spaces-rail-row flex-row overflow-x-auto px-2 py-1 xl:flex-col xl:overflow-x-hidden xl:overflow-y-auto xl:px-0 xl:py-2'
            : 'flex-col overflow-y-auto py-2',
        )}
      >
        {isLoading ? (
          <>
            {Array.from({ length: 5 }, (_, index) => (
              <HomeWave
                key={index}
                className="shrink-0 rounded-full"
                delayMs={index * 70}
                style={{ width: RAIL_ICON, height: RAIL_ICON }}
              />
            ))}
          </>
        ) : orderedSpaces.length === 0 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/${lang}/my-spaces`}
                aria-label={t('openMySpaces')}
                className={cn(
                  'grid place-items-center rounded-full border border-dashed border-border text-neutral-11',
                  'hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                )}
                style={{ width: RAIL_ICON, height: RAIL_ICON }}
              >
                <LayoutGrid
                  className="h-3.5 w-3.5"
                  strokeWidth={1.5}
                  aria-hidden
                />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{t('openMySpaces')}</TooltipContent>
          </Tooltip>
        ) : (
          <>
            {orderedSpaces.map((space) => {
              const iconUrl = resolveSpaceDisplayLogoUrl(space, logoVariant);
              const active = activeSlug === space.slug;
              return (
                <Tooltip key={space.id}>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/${lang}/dho/${space.slug}/overview`}
                      aria-label={space.title}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'relative shrink-0 overflow-hidden rounded-full bg-neutral-3',
                        'ring-1 transition-[box-shadow,transform]',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                        active
                          ? 'ring-foreground'
                          : 'ring-transparent hover:ring-foreground',
                      )}
                      style={{ width: RAIL_ICON, height: RAIL_ICON }}
                    >
                      {iconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={iconUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span
                          className="flex h-full w-full items-center justify-center text-1 font-medium text-foreground"
                          aria-hidden
                        >
                          {space.title.trim().charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{space.title}</TooltipContent>
                </Tooltip>
              );
            })}
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/${lang}/my-spaces`}
                  aria-label={t('openMySpaces')}
                  className={cn(
                    'grid shrink-0 place-items-center rounded-full border border-border text-neutral-11 xl:mt-1',
                    'hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  style={{ width: RAIL_ICON, height: RAIL_ICON }}
                >
                  <LayoutGrid
                    className="h-3.5 w-3.5"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{t('openMySpaces')}</TooltipContent>
            </Tooltip>
          </>
        )}
      </nav>
    </TooltipProvider>
  );

  if (embedded) {
    return (
      <div className="h-full w-full shrink-0 border-r-0 bg-transparent">
        {rail(false)}
      </div>
    );
  }

  // Same breakpoint as the bottom menu (`xl`). Other screens hide this
  // column once that menu is gone. Home passes `persistOnWide` so the
  // column stays on the wide layout too.
  if (!canToggle) {
    return (
      <div className={railShellClass(persistOnWide, true)}>{rail(true)}</div>
    );
  }

  return (
    <SpacesRailHandle persistOnWide={persistOnWide}>
      {rail(true)}
    </SpacesRailHandle>
  );
}

function railShellClass(persistOnWide: boolean, visibleOnNarrow: boolean) {
  return cn(
    // Below xl the icons share one row, stuck to the top of the dashboard.
    // The row paints over the mycelium so the field stays underneath it.
    'sticky top-0 z-10 h-[44px] w-full shrink-0 flex-row overflow-hidden border-b border-border bg-background',
    'xl:static xl:z-auto xl:h-full xl:w-[44px] xl:flex-col xl:border-r xl:border-b-0',
    visibleOnNarrow ? 'flex' : 'hidden',
    persistOnWide ? 'xl:flex' : 'xl:hidden',
  );
}

function SpacesRailHandle({
  children,
  persistOnWide = false,
}: {
  children: ReactNode;
  persistOnWide?: boolean;
}) {
  const { open, register } = useSpacesRailControl();
  useLayoutEffect(() => register(), [register]);
  if (!open && !persistOnWide) return null;
  return (
    <div id={SPACES_RAIL_ID} className={railShellClass(persistOnWide, open)}>
      {children}
    </div>
  );
}
