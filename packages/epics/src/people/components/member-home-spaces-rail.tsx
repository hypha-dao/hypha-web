'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { ChevronsRight, LayoutGrid } from 'lucide-react';
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
/** Collapsed handle. Wide enough to hit, narrow enough to stay quiet. */
const HANDLE_WIDTH = 28;

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
  const canToggle = !embedded && (isLoading || orderedSpaces.length > 0);

  const rail = (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label={t('spacesRail')}
        tabIndex={-1}
        className={cn(
          'narrow-scrollbar flex h-full shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-border bg-background py-2 outline-none',
          embedded ? 'w-full border-r-0 bg-transparent' : 'w-[44px]',
        )}
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

  if (!canToggle) return rail;

  return <SpacesRailHandle label={t('spacesRail')}>{rail}</SpacesRailHandle>;
}

function SpacesRailHandle({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const railId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      if (!returnFocusRef.current) return;
      returnFocusRef.current = false;
      buttonRef.current?.focus();
      return;
    }

    rootRef.current?.querySelector('nav')?.focus();

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      returnFocusRef.current = true;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (!open) {
    return (
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-expanded={false}
        aria-controls={railId}
        title={label}
        onClick={() => setOpen(true)}
        className="flex h-full shrink-0 items-start justify-center border-r border-border bg-background pt-2 text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
        style={{ width: HANDLE_WIDTH }}
      >
        <ChevronsRight
          className="block size-4"
          strokeWidth={1.25}
          aria-hidden
        />
      </button>
    );
  }

  return (
    <div
      ref={rootRef}
      id={railId}
      className="h-full shrink-0"
      onClick={(event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        if (target.closest('a')) setOpen(false);
      }}
    >
      {children}
    </div>
  );
}
