'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useMemo } from 'react';
import { ChevronDown, PanelLeftClose } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import {
  DEFAULT_SPACE_AVATAR_IMAGE,
  Space,
  useSpacesBySlugs,
} from '@hypha-platform/core/client';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAiPanel } from '../human-chat-panel-context';
import { getDhoSpaceSlugFromPathname } from '../get-dho-space-slug-from-pathname';

function getEcosystemRootId(
  space: Space,
  spacesById: Map<number, Space>,
): number {
  let cursor: Space | undefined = space;
  const seen = new Set<number>();
  while (cursor?.parentId != null) {
    if (seen.has(cursor.id)) {
      break;
    }
    seen.add(cursor.id);
    const parent = spacesById.get(cursor.parentId);
    if (!parent) {
      break;
    }
    cursor = parent;
  }
  return cursor?.id ?? space.id;
}

function getDisplayIcon(space?: Space): string {
  return space?.logoUrl?.trim() || DEFAULT_SPACE_AVATAR_IMAGE;
}

export function AiPanelHeader() {
  const { closeAiPanel } = useAiPanel();
  const t = useTranslations('AiPanel');
  const tNavigation = useTranslations('Navigation');
  const pathname = usePathname();
  const params = useParams<{ lang?: string }>();
  const activeSpaceSlug = useMemo(
    () => getDhoSpaceSlugFromPathname(pathname),
    [pathname],
  );
  const { spaces: activeSpaces } = useSpacesBySlugs(
    activeSpaceSlug ? [activeSpaceSlug] : [],
  );
  const { data: allSpaces = [] } = useSWR<Space[]>(
    '/api/v1/spaces?parentOnly=false',
    async (url: string) => {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return [];
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
    if (!activeSpace) {
      return { ecosystem: [] as Space[], others: allSpaces };
    }
    const spacesById = new Map(allSpaces.map((space) => [space.id, space]));
    const activeRootId = getEcosystemRootId(activeSpace, spacesById);
    const ecosystem: Space[] = [];
    const others: Space[] = [];
    for (const space of allSpaces) {
      if (getEcosystemRootId(space, spacesById) === activeRootId) {
        ecosystem.push(space);
      } else {
        others.push(space);
      }
    }
    const byTitle = (a: Space, b: Space) => a.title.localeCompare(b.title);
    ecosystem.sort(byTitle);
    others.sort(byTitle);
    return { ecosystem, others };
  }, [activeSpace, allSpaces]);

  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const currentTitle = activeSpace?.title?.trim() || t('title');
  const currentIcon = getDisplayIcon(activeSpace);

  return (
    <div className="flex min-h-[var(--menu-top-height,65px)] min-w-0 flex-shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-2 border-b border-border bg-background-2 px-4 py-3">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/70">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentIcon}
            alt={currentTitle}
            className="h-full w-full object-cover"
          />
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              aria-label={tNavigation('mySpaces')}
            >
              <span className="truncate">{currentTitle}</span>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[min(22rem,calc(100vw-1.5rem))] border border-border/90 p-1"
          >
            <DropdownMenuLabel className="px-2 py-1.5 text-1 text-muted-foreground">
              {tNavigation('mySpaces')}
            </DropdownMenuLabel>
            {groupedSpaces.ecosystem.map((space) => (
              <DropdownMenuItem key={space.id} asChild>
                <Link
                  href={`/${lang}/dho/${space.slug}/agreements`}
                  className="flex items-center gap-2"
                >
                  <span className="h-6 w-6 overflow-hidden rounded-md ring-1 ring-border/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getDisplayIcon(space)}
                      alt={space.title}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="truncate">{space.title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
            {groupedSpaces.ecosystem.length > 0 &&
            groupedSpaces.others.length > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            {groupedSpaces.others.map((space) => (
              <DropdownMenuItem key={space.id} asChild>
                <Link
                  href={`/${lang}/dho/${space.slug}/agreements`}
                  className="flex items-center gap-2"
                >
                  <span className="h-6 w-6 overflow-hidden rounded-md ring-1 ring-border/60">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={getDisplayIcon(space)}
                      alt={space.title}
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <span className="truncate">{space.title}</span>
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-1">
        <button
          type="button"
          onClick={closeAiPanel}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={t('hidePanel')}
          aria-label={t('closePanel')}
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
