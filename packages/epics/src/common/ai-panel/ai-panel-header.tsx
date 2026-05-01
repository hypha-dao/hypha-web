'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useMemo, useState } from 'react';
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
import { useAiPanel } from '../human-chat-panel-context';
import { getDhoSpaceSlugFromPathname } from '../get-dho-space-slug-from-pathname';
import { getRootSpace } from '../get-root-space';
import { useMemberWeb3SpaceIds } from '../../spaces/hooks/use-member-web3-space-ids';

function getDisplayIcon(space?: Space): string | null {
  return space?.logoUrl?.trim() || null;
}

export function AiPanelHeader({
  showCloseButton = true,
}: {
  showCloseButton?: boolean;
}) {
  const { closeAiPanel } = useAiPanel();
  const t = useTranslations('AiPanel');
  const tNavigation = useTranslations('Navigation');
  const tSpaces = useTranslations('Spaces');
  const pathname = usePathname();
  const params = useParams<{ lang?: string }>();
  const activeSpaceSlug = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { spaces: activeSpaces } = useSpacesBySlugs(
    activeSpaceSlug ? [activeSpaceSlug] : [],
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
  const currentTitle = activeSpace?.title?.trim() || t('title');
  const currentIcon = getDisplayIcon(activeSpace);
  const hasSpaces =
    groupedSpaces.ecosystem.length + groupedSpaces.others.length > 0;
  const [spaceSearch, setSpaceSearch] = useState('');
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
  const fallbackTitle = activeSpace?.title?.trim() || t('title');
  const canOpenSpaceMenu =
    Boolean(person?.address) &&
    !isAllSpacesLoading &&
    !allSpacesError &&
    hasSpaces;

  const renderSpaceOption = (space: Space) => (
    <DropdownMenuItem
      key={space.id}
      asChild
      className="rounded-lg py-1.5 hover:bg-background-4/70"
    >
      <Link
        href={`/${lang}/dho/${space.slug}/agreements`}
        className="flex min-w-0 items-center gap-2"
      >
        <span className="h-5 w-5 overflow-hidden rounded-md ring-1 ring-border/60">
          {getDisplayIcon(space) ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getDisplayIcon(space) ?? undefined}
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
    <div className="grid h-[var(--menu-top-height,70px)] min-w-0 flex-shrink-0 grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-3 border-b border-border bg-background-2 px-4 py-2">
      <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/70">
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
          <Sparkles className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex min-w-0 items-center justify-center px-0.5">
        {canOpenSpaceMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex h-8 w-full min-w-0 max-w-[14.5rem] items-center justify-center gap-1.5 rounded-xl border border-border/55 bg-background-3/80 px-3 text-sm font-semibold text-foreground shadow-[0_1px_8px_-8px_rgba(0,0,0,0.6)] transition-colors hover:border-border/65 hover:bg-background-4/85"
                aria-label={tNavigation('mySpaces')}
              >
                <span className="max-w-[9rem] truncate text-center">
                  {currentTitle}
                </span>
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="center"
              sideOffset={0}
              className="w-[min(16rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-border/60 bg-background-3 p-0 shadow-xl"
            >
              <div className="max-h-[24.5rem] overflow-y-auto p-1.5 narrow-scrollbar">
                <div className="sticky top-0 z-20 mb-1 rounded-t-xl border-b border-border/70 bg-background-3 px-1 pb-1.5">
                  <DropdownMenuLabel className="px-2 py-1.5 text-1 text-muted-foreground">
                    {tNavigation('mySpaces')}
                  </DropdownMenuLabel>
                  <div className="px-1">
                    <input
                      type="text"
                      value={spaceSearch}
                      onChange={(event) => setSpaceSearch(event.target.value)}
                      placeholder={tSpaces('search')}
                      className="h-8 w-full rounded-lg border border-border/60 bg-background-2 px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border/85"
                      aria-label={tSpaces('search')}
                    />
                  </div>
                </div>
                {!hasFilteredSpaces ? (
                  <DropdownMenuItem disabled>{fallbackTitle}</DropdownMenuItem>
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
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="inline-flex h-8 w-full min-w-0 max-w-[14.5rem] items-center justify-center rounded-xl border border-border/55 bg-background-3/80 px-3 text-sm font-semibold text-foreground/90">
            <span className="max-w-[9rem] truncate text-center">
              {fallbackTitle}
            </span>
          </div>
        )}
      </div>
      <div className="flex h-7 w-7 items-center justify-end">
        {showCloseButton ? (
          <button
            type="button"
            onClick={closeAiPanel}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={t('hidePanel')}
            aria-label={t('closePanel')}
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
