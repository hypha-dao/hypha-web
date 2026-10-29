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
import { useMe, type MemberIntelligence } from '@hypha-platform/core/client';

import {
  readRecentSpaceSlugs,
  subscribeRecentSpaceSlugs,
} from '../../common/recent-space-history';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';
import { groupSpacesByEcosystemRecency } from './order-spaces-by-ecosystem';
import { SPACES_RAIL_ID, useSpacesRailControl } from './spaces-rail-control';
import { HomeWave } from './member-home-wave';

export {
  ecosystemRootId,
  flattenEcosystemSpaceGroups,
  groupSpacesByEcosystemRecency,
  orderSpacesByRecentVisit,
  type SpaceEcosystemGroup,
} from './order-spaces-by-ecosystem';

type HomeSpace = MemberIntelligence['spaces'][number];

/** Compact spaces bar. Marks are 32px inside a 44px row or column. */
const RAIL_ICON = 32;

export function MemberHomeSpacesRail({
  lang,
  spaces,
  isLoading,
  activeSlug,
  embedded = false,
  persistOnWide = false,
  /** Mobile menu: one scrolling row under the header. Desktop AI panel: column. */
  layout = 'column',
}: {
  lang: Locale;
  spaces: HomeSpace[];
  isLoading?: boolean;
  activeSlug?: string | null;
  /** Fill the left menu column instead of sitting as its own rail. */
  embedded?: boolean;
  /**
   * Home only. The column follows the top-bar circle at every width,
   * including the wide layout where the bottom menu is gone. It starts closed.
   */
  persistOnWide?: boolean;
  layout?: 'column' | 'row';
}) {
  const t = useTranslations('MemberHome');
  const { person } = useMe();
  const hideSpacesListing = person?.primaryOrientation === 'member';
  const { resolvedTheme } = useTheme();
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const row = layout === 'row';
  const [recentSlugs, setRecentSlugs] = useState<string[]>(() =>
    readRecentSpaceSlugs(),
  );

  useEffect(() => subscribeRecentSpaceSlugs(setRecentSlugs), []);

  const ecosystemGroups = useMemo(
    () => groupSpacesByEcosystemRecency(spaces, recentSlugs),
    [recentSlugs, spaces],
  );
  const spaceCount = ecosystemGroups.reduce(
    (total, group) => total + group.spaces.length,
    0,
  );
  const canToggle = !embedded && (isLoading || spaceCount > 0);
  const tipSide = row ? 'bottom' : 'right';

  const rail = (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t('spacesRail')}
        tabIndex={-1}
        className={cn(
          'narrow-scrollbar flex min-h-0 w-full min-w-0 shrink-0 outline-none',
          row
            ? 'flex-row items-center gap-1.5 overflow-x-auto px-3 py-2'
            : 'h-full flex-col items-center gap-1 overflow-y-auto px-0 py-2',
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
        ) : spaceCount === 0 ? (
          hideSpacesListing ? null : (
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
              <TooltipContent side={tipSide}>
                {t('openMySpaces')}
              </TooltipContent>
            </Tooltip>
          )
        ) : (
          <>
            {ecosystemGroups.map((group, groupIndex) => (
              <div
                key={group.rootId}
                className={cn(
                  'flex shrink-0 items-center gap-1',
                  row ? 'flex-row' : 'flex-col',
                )}
              >
                {groupIndex > 0 ? (
                  <span
                    aria-hidden
                    className={cn(
                      'shrink-0 bg-border/80',
                      row ? 'mx-0.5 h-4 w-px' : 'my-0.5 h-px w-4',
                    )}
                  />
                ) : null}
                {group.spaces.map((space) => {
                  const iconUrl = resolveSpaceDisplayLogoUrl(
                    space,
                    logoVariant,
                  );
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
                              {space.title.trim().charAt(0).toUpperCase() ||
                                '?'}
                            </span>
                          )}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side={tipSide}>
                        {space.title}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
            {hideSpacesListing ? null : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`/${lang}/my-spaces`}
                    aria-label={t('openMySpaces')}
                    className={cn(
                      'grid shrink-0 place-items-center rounded-full border border-border text-neutral-11',
                      'hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                      row ? null : 'mt-1',
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
                <TooltipContent side={tipSide}>
                  {t('openMySpaces')}
                </TooltipContent>
              </Tooltip>
            )}
          </>
        )}
      </nav>
    </TooltipProvider>
  );

  if (embedded) {
    return (
      <div
        className={cn(
          'w-full shrink-0 border-r-0 bg-transparent',
          row ? null : 'h-full',
        )}
      >
        {rail}
      </div>
    );
  }

  if (!canToggle) {
    return <div className={railShellClass(persistOnWide, layout)}>{rail}</div>;
  }

  return (
    <SpacesRailHandle persistOnWide={persistOnWide} layout={layout}>
      {rail}
    </SpacesRailHandle>
  );
}

function railShellClass(
  showOnWide: boolean,
  layout: 'column' | 'row' = 'column',
) {
  if (layout === 'row') {
    return cn(
      'sticky top-[var(--menu-top-height,4.5rem)] z-10 w-full shrink-0 border-b border-border bg-background',
      showOnWide ? null : 'xl:hidden',
    );
  }
  return cn(
    'flex h-full min-h-0 w-[44px] shrink-0 flex-col overflow-hidden border-r border-border bg-background',
    showOnWide ? null : 'xl:hidden',
  );
}

function SpacesRailHandle({
  children,
  persistOnWide = false,
  layout = 'column',
}: {
  children: ReactNode;
  persistOnWide?: boolean;
  layout?: 'column' | 'row';
}) {
  const { open, register } = useSpacesRailControl();
  useLayoutEffect(() => register(), [register]);
  if (!open) return null;
  return (
    <div id={SPACES_RAIL_ID} className={railShellClass(persistOnWide, layout)}>
      {children}
    </div>
  );
}
