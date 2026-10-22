'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useParams, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Address, Space, useMe } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { getDhoSpaceContextPath } from '../../common/get-dho-space-context-path';
import { getDhoSpaceSlugFromPathname } from '../../common/get-dho-space-slug-from-pathname';
import { getRootSpace } from '../../common/get-root-space';
import { useMemberWeb3SpaceIds } from '../hooks/use-member-web3-space-ids';
import { resolveSpaceDisplayLogoUrl } from '../utils/resolve-space-display-logo-url';
import { SpaceSwitcherOption } from './space-switcher-option';

/**
 * The same My Spaces list as the desktop space switcher: search, the current
 * ecosystem first, then the rest.
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
  const { resolvedTheme } = useTheme();
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
  const logoVariant = resolvedTheme === 'dark' ? 'dark' : 'light';

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

  const renderSpace = (space: Space) => (
    <SpaceSwitcherOption
      key={space.id}
      href={
        getDhoSpaceContextPath({
          pathname,
          lang,
          spaceSlug: space.slug,
        }) ?? `/${lang}/dho/${space.slug}/agreements`
      }
      title={space.title}
      iconUrl={resolveSpaceDisplayLogoUrl(space, logoVariant)}
      onClick={onSelect}
      className="rounded-lg px-2 py-1.5 text-sm text-foreground hover:bg-background-4/70"
    />
  );

  return (
    <div
      className={cn('flex h-full min-h-0 flex-col bg-background-2', className)}
    >
      <div className="shrink-0 border-b border-border/70 bg-background-3 px-2 pb-1.5 pt-1">
        <p className="px-2 py-1.5 text-1 text-muted-foreground">
          {tNavigation('mySpaces')}
        </p>
        <div className="px-1">
          <input
            ref={searchInputRef}
            type="text"
            value={spaceSearch}
            onChange={(event) => setSpaceSearch(event.target.value)}
            placeholder={tSpaces('search')}
            className="h-8 w-full rounded-lg border border-border/60 bg-background-2 px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-border/85"
            aria-label={tSpaces('search')}
          />
        </div>
      </div>
      <div className="narrow-scrollbar min-h-0 flex-1 overflow-y-auto p-1.5">
        {isAllSpacesLoading ? null : !hasFilteredSpaces || allSpacesError ? (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            {normalizedSearch || allSpacesError
              ? tSpaces('noSpacesFound')
              : activeSpace?.title?.trim() || tSpaces('noSpacesFound')}
          </p>
        ) : (
          <>
            {filtered.ecosystem.map(renderSpace)}
            {filtered.ecosystem.length > 0 && filtered.others.length > 0 ? (
              <div className="my-1 h-px bg-border/70" />
            ) : null}
            {filtered.others.map(renderSpace)}
          </>
        )}
      </div>
    </div>
  );
}
