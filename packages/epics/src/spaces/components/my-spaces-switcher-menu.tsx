'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Address, Space, useMe } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { getDhoSpaceContextPath } from '../../common/get-dho-space-context-path';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import { getRootSpace } from '../../common/get-root-space';
import { useMemberWeb3SpaceIds } from '../hooks/use-member-web3-space-ids';
import { SpaceCardWithDiscoverability } from './space-card-with-discoverability';

/**
 * My Spaces sheet for mobile: search, the current ecosystem first, then the
 * rest — as cards, same shape as My Spaces / Network.
 */
export function MySpacesSwitcherMenu({
  open,
  onSelect,
  className,
}: {
  open: boolean;
  onSelect?: () => void;
  className?: string;
}) {
  const tNavigation = useTranslations('Navigation');
  const tSpaces = useTranslations('Spaces');
  const pathname = usePathname() ?? '';
  const params = useParams<{ lang?: string }>();
  const lang = typeof params.lang === 'string' ? params.lang : 'en';
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

  const activeSpaceSlug = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const activeSpace = useMemo(
    () => allSpaces.find((space) => space.slug === activeSpaceSlug),
    [activeSpaceSlug, allSpaces],
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

  const [spaceSearch, setSpaceSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const normalizedSearch = spaceSearch.trim().toLowerCase();
  const filtered = useMemo(() => {
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
    filtered.ecosystem.length + filtered.others.length > 0;

  useEffect(() => {
    if (open) return;
    setSpaceSearch('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const focusSearch = () => {
      searchInputRef.current?.focus({ preventScroll: true });
    };
    const rafId = requestAnimationFrame(focusSearch);
    return () => cancelAnimationFrame(rafId);
  }, [open]);

  const getHref = (slug: string) =>
    getDhoSpaceContextPath({
      pathname,
      lang,
      spaceSlug: slug,
    }) ?? `/${lang}/dho/${slug}/agreements`;

  const renderSpace = (space: Space) =>
    space.slug ? (
      <div key={space.id} className="flex h-full flex-col">
        <SpaceCardWithDiscoverability
          space={space}
          getHref={getHref}
          onNavigate={onSelect}
        />
      </div>
    ) : null;

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col bg-background-2', className)}
    >
      <div className="shrink-0 border-b border-border/70 bg-background-3 px-3 pb-2 pt-2">
        <p className="px-1 py-1.5 text-1 text-muted-foreground">
          {tNavigation('mySpaces')}
        </p>
        <input
          ref={searchInputRef}
          type="text"
          value={spaceSearch}
          onChange={(event) => setSpaceSearch(event.target.value)}
          placeholder={tSpaces('search')}
          className="h-9 w-full rounded-lg border border-border/60 bg-background-2 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border/85"
          aria-label={tSpaces('search')}
        />
      </div>
      <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto p-3">
        {isAllSpacesLoading ? null : !hasFilteredSpaces || allSpacesError ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            {normalizedSearch || allSpacesError
              ? tSpaces('noSpacesFound')
              : activeSpace?.title?.trim() || tSpaces('noSpacesFound')}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.ecosystem.length > 0 ? (
              <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3">
                {filtered.ecosystem.map(renderSpace)}
              </div>
            ) : null}
            {filtered.ecosystem.length > 0 && filtered.others.length > 0 ? (
              <div className="h-px bg-border/70" />
            ) : null}
            {filtered.others.length > 0 ? (
              <div className="grid auto-rows-fr grid-cols-1 items-stretch gap-3">
                {filtered.others.map(renderSpace)}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
