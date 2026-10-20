'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

/** Compact spaces bar. Marks fill a 44px column with a small gap. */
const RAIL_ICON = 32;
/** Resting cue. Wide enough to notice, narrow enough to stay out of the way. */
const CUE_ICON = 14;
const CUE_WIDTH = 22;

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
}: {
  lang: Locale;
  spaces: HomeSpace[];
  isLoading?: boolean;
  activeSlug?: string | null;
  /** Fill the left menu column instead of sitting as its own rail. */
  embedded?: boolean;
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
  const revealOnHover = !embedded && !isLoading && orderedSpaces.length > 0;
  const slimColumn = !embedded && !revealOnHover;

  const rail = (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t('spacesRail')}
        className={cn(
          'narrow-scrollbar flex h-full shrink-0 flex-col items-center gap-1 overflow-y-auto py-2',
          embedded
            ? 'w-full bg-transparent'
            : 'border-r border-border bg-background',
          !embedded && !slimColumn && 'w-[44px]',
        )}
        style={slimColumn ? { width: CUE_WIDTH } : undefined}
      >
        {isLoading ? (
          <>
            {Array.from({ length: slimColumn ? 3 : 5 }, (_, index) => (
              <Skeleton
                key={index}
                loading
                width={`${slimColumn ? CUE_ICON : RAIL_ICON}px`}
                height={`${slimColumn ? CUE_ICON : RAIL_ICON}px`}
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
                style={{
                  width: slimColumn ? CUE_ICON : RAIL_ICON,
                  height: slimColumn ? CUE_ICON : RAIL_ICON,
                }}
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
                    'mt-1 grid shrink-0 place-items-center rounded-full border border-border text-neutral-11',
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

  if (!revealOnHover) return rail;

  return (
    <SpacesRailHoverCue
      label={t('spacesRail')}
      spaces={orderedSpaces}
      logoVariant={logoVariant}
    >
      {rail}
    </SpacesRailHoverCue>
  );
}

function SpacesRailHoverCue({
  label,
  spaces,
  logoVariant,
  children,
}: {
  label: string;
  spaces: HomeSpace[];
  logoVariant: 'dark' | 'light';
  children: ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const shown = hovered || pinned;
  const cueSpaces = spaces.slice(0, spaces.length > 4 ? 3 : 4);
  const extra = spaces.length - cueSpaces.length;

  useEffect(
    () => () => {
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!shown) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setPinned(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setPinned(false);
      setHovered(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [shown]);

  const show = () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    setHovered(true);
  };
  const hideSoon = () => {
    if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setHovered(false), 140);
  };

  return (
    <div
      ref={rootRef}
      className="relative z-20 h-full shrink-0"
      style={{ width: CUE_WIDTH }}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') show();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') hideSoon();
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={shown}
        onClick={() => setPinned((open) => !open)}
        className="flex h-full w-full flex-col items-center gap-1 border-r border-border bg-background py-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {cueSpaces.map((space) => {
          const iconUrl = resolveSpaceDisplayLogoUrl(space, logoVariant);
          return (
            <span
              key={space.id}
              className="shrink-0 overflow-hidden rounded-full bg-neutral-3 ring-1 ring-border"
              style={{ width: CUE_ICON, height: CUE_ICON }}
            >
              {iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={iconUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[8px] leading-none text-foreground">
                  {space.title.trim().charAt(0).toUpperCase() || '?'}
                </span>
              )}
            </span>
          );
        })}
        {extra > 0 ? (
          <span className="text-[8px] leading-none text-neutral-11">
            +{extra}
          </span>
        ) : null}
      </button>
      <div
        className={cn(
          'absolute top-0 left-0 z-30 h-full transition-opacity duration-150',
          shown
            ? 'visible opacity-100'
            : 'pointer-events-none invisible opacity-0',
        )}
      >
        {children}
      </div>
    </div>
  );
}
