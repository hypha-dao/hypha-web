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
import { LayoutGrid, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
const RAIL_WIDTH = 44;
/** Toggle stays this size so opening the list does not shift it. */
const HANDLE_WIDTH = 36;

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
          'narrow-scrollbar flex h-full min-h-0 w-full shrink-0 flex-col items-center gap-1 overflow-y-auto py-2 outline-none',
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

  if (embedded) {
    return (
      <div className="h-full w-full shrink-0 border-r-0 bg-transparent">
        {rail}
      </div>
    );
  }

  // Same breakpoint as the bottom menu (`xl:hidden`). Never on the web layout.
  if (!canToggle) {
    return (
      <div
        className="h-full shrink-0 border-r border-border bg-background xl:hidden"
        style={{ width: RAIL_WIDTH }}
      >
        {rail}
      </div>
    );
  }

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
  const [canHover, setCanHover] = useState(false);
  const Icon = open ? PanelLeftClose : PanelLeftOpen;

  useEffect(() => {
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setCanHover(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!open) {
      if (!returnFocusRef.current) return;
      returnFocusRef.current = false;
      buttonRef.current?.focus();
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      returnFocusRef.current = true;
      setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || canHover) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [canHover, open]);

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => {
        if (canHover) setOpen(true);
      }}
      onMouseLeave={() => {
        if (!canHover) return;
        if (rootRef.current?.contains(document.activeElement)) return;
        setOpen(false);
      }}
      onBlur={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && rootRef.current?.contains(next)) return;
        setOpen(false);
      }}
      className={cn(
        'flex shrink-0 flex-col bg-background xl:hidden',
        open
          ? 'h-full border-r border-border'
          : 'self-start border-r border-border',
      )}
      style={{ width: RAIL_WIDTH }}
    >
      <button
        ref={buttonRef}
        type="button"
        id={`${railId}-toggle`}
        aria-label={label}
        aria-expanded={open}
        aria-controls={railId}
        title={label}
        onFocus={() => setOpen(true)}
        onClick={() => {
          if (canHover) return;
          setOpen((current) => !current);
        }}
        className={cn(
          'flex w-full shrink-0 items-center justify-center border-b border-border text-foreground',
          'hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
        )}
        style={{ height: HANDLE_WIDTH }}
      >
        <Icon className="block size-4" strokeWidth={1.25} aria-hidden />
      </button>
      {open ? (
        <div id={railId} className="min-h-0 w-full flex-1 overflow-hidden">
          {children}
        </div>
      ) : null}
    </div>
  );
}
