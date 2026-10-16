'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { LayoutGrid } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import {
  Skeleton,
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

type HomeSpace = MemberIntelligence['spaces'][number];

const RAIL_ICON = 40;

function orderSpacesByRecentVisit(
  spaces: HomeSpace[],
  recentSlugs: string[],
): HomeSpace[] {
  if (spaces.length === 0) return spaces;
  const bySlug = new Map(spaces.map((space) => [space.slug, space]));
  const ordered: HomeSpace[] = [];
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
}: {
  lang: Locale;
  spaces: HomeSpace[];
  isLoading?: boolean;
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

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t('spacesRail')}
        className="narrow-scrollbar flex h-full w-[3.75rem] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-background py-3"
      >
        {isLoading ? (
          <>
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton
                key={index}
                loading
                width={`${RAIL_ICON}px`}
                height={`${RAIL_ICON}px`}
                className="shrink-0 rounded-full bg-foreground/10"
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
                <LayoutGrid className="h-4 w-4" strokeWidth={1.5} aria-hidden />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">{t('openMySpaces')}</TooltipContent>
          </Tooltip>
        ) : (
          <>
            {orderedSpaces.map((space) => {
              const iconUrl = resolveSpaceDisplayLogoUrl(space, logoVariant);
              return (
                <Tooltip key={space.id}>
                  <TooltipTrigger asChild>
                    <Link
                      href={`/${lang}/dho/${space.slug}/overview`}
                      aria-label={space.title}
                      className={cn(
                        'relative shrink-0 overflow-hidden rounded-full bg-neutral-3',
                        'ring-1 ring-transparent transition-[box-shadow,transform] hover:ring-foreground',
                        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
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
                          className="flex h-full w-full items-center justify-center text-2 font-medium text-foreground"
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
                    'mt-1 grid shrink-0 place-items-center rounded-full border border-border text-neutral-11',
                    'hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  )}
                  style={{ width: RAIL_ICON, height: RAIL_ICON }}
                >
                  <LayoutGrid
                    className="h-4 w-4"
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
}
