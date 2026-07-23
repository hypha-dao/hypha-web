'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, PanelLeftClose, Sparkles } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import {
  Address,
  Space,
  useMe,
  useSpacesBySlugs,
} from '@hypha-platform/core/client';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useAiPanel } from '../human-chat-panel-context';
import { getDhoSpaceContextPath } from '../get-dho-space-context-path';
import { getDhoSpaceSlugFromPathname } from '../get-dho-space-slug-from-pathname';
import { getRootSpace } from '../get-root-space';
import { useMemberWeb3SpaceIds } from '../../spaces/hooks/use-member-web3-space-ids';
import { resolveSpaceDisplayLogoUrl } from '../../spaces/utils/resolve-space-display-logo-url';

function getDisplayIcon(
  space: Space | undefined,
  preferredVariant: 'light' | 'dark',
): string | null {
  return resolveSpaceDisplayLogoUrl(space, preferredVariant);
}

export function AiPanelHeader({
  showCloseButton = true,
  onCloseButtonClick,
  leftSlot,
  rightSlot,
}: {
  showCloseButton?: boolean;
  onCloseButtonClick?: () => void;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
}) {
  const { closeAiPanel } = useAiPanel();
  const t = useTranslations('AiPanel');
  const tNavigation = useTranslations('Navigation');
  const tSpaces = useTranslations('Spaces');
  const { resolvedTheme } = useTheme();
  const pathname = usePathname();
  const params = useParams<{ lang?: string }>();
  const activeSpaceSlug = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { spaces: activeSpaces } = useSpacesBySlugs(
    activeSpaceSlug ? [activeSpaceSlug] : [],
    false,
  );
  const { person } = useMe();
  const { web3SpaceIds } = useMemberWeb3SpaceIds({
    personAddress: person?.address as Address | undefined,
  });
  const {
    data: allSpaces = [],
    error: allSpacesError,
    isLoading: isAllSpacesLoading,
  } = useSWR<Space[]>(
    '/api/v1/spaces?parentOnly=false',
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new Error(`Failed to load spaces: ${response.status}`);
      }
      return (await response.json()) as Space[];
    },
  );
  const activeSpace = useMemo(
    () =>
      allSpaces.find((space) => space.slug === activeSpaceSlug) ??
      activeSpaces[0],
    [activeSpaceSlug, allSpaces, activeSpaces],
  );

  const groupedSpaces = useMemo(() => {
    const memberSpaceIds = new Set(
      (web3SpaceIds ?? []).map((id) => id.toString()),
    );
    const mySpaces = allSpaces.filter((space) => {
      if (space.web3SpaceId == null) return false;
      return memberSpaceIds.has(String(space.web3SpaceId));
    });
    if (!activeSpace) {
      return { ecosystem: [] as Space[], others: mySpaces };
    }
    const activeRootId =
      getRootSpace(activeSpace, allSpaces)?.id ?? activeSpace.id;
    const ecosystem: Space[] = [];
    const others: Space[] = [];
    for (const space of mySpaces) {
      if ((getRootSpace(space, allSpaces)?.id ?? space.id) === activeRootId) {
        ecosystem.push(space);
      } else {
        others.push(space);
      }
    }
    const byTitle = (a: Space, b: Space) => a.title.localeCompare(b.title);
    ecosystem.sort(byTitle);
    others.sort(byTitle);
    return { ecosystem, others };
  }, [activeSpace, allSpaces, web3SpaceIds]);

  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';
  const currentTitle =
    activeSpace?.title?.trim() || activeSpaceSlug?.trim() || t('title');
  const currentIcon = getDisplayIcon(activeSpace, logoVariant);
  const hasSpaces =
    groupedSpaces.ecosystem.length + groupedSpaces.others.length > 0;
  const [spaceSearch, setSpaceSearch] = useState('');
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const spaceSearchInputRef = useRef<HTMLInputElement>(null);
  const normalizedSearch = spaceSearch.trim().toLowerCase();
  const filteredGroupedSpaces = useMemo(() => {
    if (!normalizedSearch) return groupedSpaces;
    const matches = (space: Space) =>
      space.title.toLowerCase().includes(normalizedSearch) ||
      space.slug.toLowerCase().includes(normalizedSearch);
    return {
      ecosystem: groupedSpaces.ecosystem.filter(matches),
      others: groupedSpaces.others.filter(matches),
    };
  }, [groupedSpaces, normalizedSearch]);
  const hasFilteredSpaces =
    filteredGroupedSpaces.ecosystem.length +
      filteredGroupedSpaces.others.length >
    0;
  const fallbackTitle =
    activeSpace?.title?.trim() || activeSpaceSlug?.trim() || t('title');
  const canOpenSpaceMenu =
    Boolean(person?.address) &&
    !isAllSpacesLoading &&
    !allSpacesError &&
    hasSpaces;

  useEffect(() => {
    if (!spaceMenuOpen && spaceSearch) {
      setSpaceSearch('');
    }
  }, [spaceMenuOpen, spaceSearch]);

  useEffect(() => {
    if (!spaceMenuOpen) return;

    requestAnimationFrame(() => {
      spaceSearchInputRef.current?.focus();
    });
  }, [spaceMenuOpen]);

  const renderSpaceOption = (space: Space) => (
    <DropdownMenuItem
      key={space.id}
      asChild
      className="rounded-lg py-1.5 hover:bg-background-4/70"
    >
      <Link
        href={
          getDhoSpaceContextPath({
            pathname,
            lang,
            spaceSlug: space.slug,
          }) ?? `/${lang}/dho/${space.slug}/agreements`
        }
        className="flex min-w-0 items-center gap-2"
      >
        <span className="h-5 w-5 overflow-hidden rounded-full ring-1 ring-border/60">
          {getDisplayIcon(space, logoVariant) ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getDisplayIcon(space, logoVariant) ?? undefined}
                alt={space.title}
                className="h-full w-full object-cover"
              />
            </>
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-muted">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          )}
        </span>
        <span className="min-w-0 max-w-[11.25rem] flex-1 truncate">
          {space.title}
        </span>
      </Link>
    </DropdownMenuItem>
  );

  return (
    <div
      className="grid h-[var(--menu-top-height,70px)] min-w-0 flex-shrink-0 grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-3 border-b border-border/80 bg-background-2/92 ps-4 pe-5 py-2 backdrop-blur-md supports-[backdrop-filter]:bg-background-2/80"
      data-craft-icons
    >
      {leftSlot ? (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center">
          {leftSlot}
        </div>
      ) : (
        <div className="h-8 w-8 shrink-0" aria-hidden />
      )}

      <div className="min-w-0 px-3">
        <div className="mx-auto flex w-full min-w-0 max-w-[22rem] justify-center transition-[max-width] duration-200 ease-out">
          {canOpenSpaceMenu ? (
            <DropdownMenu
              modal={true}
              open={spaceMenuOpen}
              onOpenChange={setSpaceMenuOpen}
            >
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-border/55 bg-background-3/80 px-3.5 text-sm font-semibold tracking-tight text-foreground transition-[background-color,border-color,gap,padding] duration-200 ease-out hover:border-border/65 hover:bg-background-4/85"
                  aria-label={tNavigation('mySpaces')}
                >
                  <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-border/60">
                    {currentIcon ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={currentIcon}
                          alt={currentTitle}
                          className="h-full w-full object-cover"
                        />
                      </>
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-muted">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                      </span>
                    )}
                  </span>
                  <span className="max-w-[16rem] truncate text-center [font-family:var(--font-family-heading)] transition-[max-width] duration-200 ease-out">
                    {currentTitle}
                  </span>
                  <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="bottom"
                align="center"
                sideOffset={4}
                collisionPadding={8}
                className="relative isolate z-[70] w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-border/60 bg-background-2 p-0 shadow-md data-[state=open]:animate-none data-[state=closed]:animate-none"
              >
                <div className="flex max-h-[24.5rem] min-h-0 flex-col">
                  <div className="shrink-0 border-b border-border/70 bg-background-3 px-2 pb-1.5 pt-1">
                    <DropdownMenuLabel className="px-2 py-1.5 text-1 text-muted-foreground">
                      {tNavigation('mySpaces')}
                    </DropdownMenuLabel>
                    <div className="px-1">
                      <input
                        ref={spaceSearchInputRef}
                        type="text"
                        value={spaceSearch}
                        onChange={(event) => setSpaceSearch(event.target.value)}
                        onKeyDown={(event) => {
                          event.stopPropagation();
                        }}
                        placeholder={tSpaces('search')}
                        className="h-8 w-full rounded-lg border border-border/60 bg-background-2 px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border/85"
                        aria-label={tSpaces('search')}
                      />
                    </div>
                  </div>
                  <div className="min-h-0 overflow-y-auto p-1.5 narrow-scrollbar">
                    {!hasFilteredSpaces ? (
                      <DropdownMenuItem disabled>
                        {normalizedSearch
                          ? tSpaces('noSpacesFound')
                          : fallbackTitle}
                      </DropdownMenuItem>
                    ) : null}
                    {hasFilteredSpaces &&
                      filteredGroupedSpaces.ecosystem.map(renderSpaceOption)}
                    {filteredGroupedSpaces.ecosystem.length > 0 &&
                    filteredGroupedSpaces.others.length > 0 ? (
                      <DropdownMenuSeparator />
                    ) : null}
                    {hasFilteredSpaces &&
                      filteredGroupedSpaces.others.map(renderSpaceOption)}
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="inline-flex h-8 w-full min-w-0 items-center justify-center gap-2 rounded-lg border border-border/55 bg-background-3/80 px-3.5 text-sm font-semibold text-foreground/90 transition-[background-color,border-color,gap,padding] duration-200 ease-out">
              <span className="h-5 w-5 shrink-0 overflow-hidden rounded-full ring-1 ring-border/60">
                {currentIcon ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={currentIcon}
                      alt={fallbackTitle}
                      className="h-full w-full object-cover"
                    />
                  </>
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-muted">
                    <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                  </span>
                )}
              </span>
              <span className="max-w-[16rem] truncate text-center transition-[max-width] duration-200 ease-out">
                {fallbackTitle}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex h-8 w-8 shrink-0 items-center justify-end">
        {rightSlot ? (
          rightSlot
        ) : showCloseButton ? (
          <button
            type="button"
            onClick={onCloseButtonClick ?? closeAiPanel}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t('hidePanel')}
            aria-label={t('closePanel')}
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
