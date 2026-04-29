'use client';

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { MenuTop } from '@hypha-platform/ui';
import { getDhoSpaceSlugFromPathname } from '@hypha-platform/epics';
import useSWR from 'swr';
import { DEFAULT_SPACE_AVATAR_IMAGE, Space } from '@hypha-platform/core/client';
import Link from 'next/link';

type ConnectedMenuTopProps = {
  children?: ReactNode;
  leadingAction?: ReactNode;
  trailingAction?: ReactNode;
  logoHref?: string;
  hrefTarget?: string;
  openMenuLabel?: string;
  closeMenuLabel?: string;
  aiChatEnabled: boolean;
};

function getRootSpace(activeSpace?: Space, spaces: Space[] = []) {
  if (!activeSpace) return null;
  const spacesById = new Map(spaces.map((space) => [space.id, space]));
  let cursor: Space | undefined = activeSpace;
  const seen = new Set<number>();
  while (cursor?.parentId != null) {
    if (seen.has(cursor.id)) break;
    seen.add(cursor.id);
    const parent = spacesById.get(cursor.parentId);
    if (!parent) break;
    cursor = parent;
  }
  return cursor ?? activeSpace;
}

export function ConnectedMenuTop({
  children,
  leadingAction,
  trailingAction,
  logoHref,
  hrefTarget,
  openMenuLabel,
  closeMenuLabel,
  aiChatEnabled,
}: ConnectedMenuTopProps) {
  const pathname = usePathname();
  const isSpaceRoute = /^\/[^/]+\/dho\/[^/]+/.test(pathname);
  const lang = useMemo(() => {
    const match = pathname.match(/^\/([^/]+)\//);
    return match?.[1] ?? 'en';
  }, [pathname]);
  const activeSpaceSlug = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { data: allSpaces = [] } = useSWR<Space[]>(
    isSpaceRoute ? '/api/v1/spaces?parentOnly=false' : null,
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];
      return (await response.json()) as Space[];
    },
  );
  const rootSpace = useMemo(() => {
    if (!activeSpaceSlug) return null;
    const activeSpace = allSpaces.find(
      (space) => space.slug === activeSpaceSlug,
    );
    return getRootSpace(activeSpace, allSpaces);
  }, [activeSpaceSlug, allSpaces]);
  const rootConfigHref =
    rootSpace?.slug != null
      ? `/${lang}/dho/${rootSpace.slug}/agreements/space-configuration`
      : logoHref;
  const rootSpaceHref =
    rootSpace?.slug != null
      ? `/${lang}/dho/${rootSpace.slug}/agreements`
      : logoHref;
  const rootLogoUrl = rootSpace?.logoUrl?.trim() || '';
  const rootTitle = rootSpace?.title?.trim() || '';

  const logoNode =
    aiChatEnabled && isSpaceRoute && rootSpace ? (
      rootLogoUrl ? (
        <Link
          href={rootSpaceHref ?? '#'}
          className="inline-flex items-center gap-2"
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={rootLogoUrl}
              alt={rootTitle}
              className="h-full w-full object-cover"
            />
          </span>
          <span className="inline-block max-w-[18rem] truncate text-2xl font-semibold leading-none tracking-tight text-foreground">
            {rootTitle}
          </span>
        </Link>
      ) : (
        <Link
          href={rootConfigHref ?? '#'}
          className="inline-flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1 text-sm font-medium text-muted-foreground hover:bg-muted"
        >
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/70">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={DEFAULT_SPACE_AVATAR_IMAGE}
              alt="Ecosystem Logo"
              className="h-full w-full object-cover opacity-60"
            />
          </span>
          <span>Ecosystem Logo</span>
        </Link>
      )
    ) : undefined;

  return (
    <MenuTop
      logoHref={logoHref}
      logoNode={logoNode}
      hrefTarget={hrefTarget}
      openMenuLabel={openMenuLabel}
      closeMenuLabel={closeMenuLabel}
      leadingAction={leadingAction}
      trailingAction={trailingAction}
    >
      {children}
    </MenuTop>
  );
}
