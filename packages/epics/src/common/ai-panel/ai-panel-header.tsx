'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { useMemo } from 'react';
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
import { useMemberWeb3SpaceIds } from '../../spaces/hooks/use-member-web3-space-ids';

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
    const spacesById = new Map(mySpaces.map((space) => [space.id, space]));
    const activeRootId = getEcosystemRootId(activeSpace, spacesById);
    const ecosystem: Space[] = [];
    const others: Space[] = [];
    for (const space of mySpaces) {
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
  }, [activeSpace, allSpaces, web3SpaceIds]);

  const lang = typeof params.lang === 'string' ? params.lang : 'en';
  const currentTitle = activeSpace?.title?.trim() || t('title');
  const currentIcon = getDisplayIcon(activeSpace);
  const hasSpaces =
    groupedSpaces.ecosystem.length + groupedSpaces.others.length > 0;
  const fallbackTitle = activeSpace?.title?.trim() || t('title');

  return (
    <div className="relative flex h-[var(--menu-top-height,65px)] min-w-0 flex-shrink-0 items-center border-b border-border bg-background-2 px-4 py-2">
      <div className="absolute left-1/2 top-1/2 flex w-[calc(100%-5.5rem)] max-w-[16.75rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted ring-1 ring-border/70">
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
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-border/55 bg-background-3/80 px-2.5 text-left text-sm font-semibold text-foreground shadow-[0_1px_8px_-8px_rgba(0,0,0,0.6)] transition-colors hover:border-border/65 hover:bg-background-4/85"
              aria-label={tNavigation('mySpaces')}
            >
              <span className="max-w-[9rem] truncate">{currentTitle}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="center"
            className="w-[min(16rem,calc(100vw-1.5rem))] max-h-[24.5rem] overflow-y-auto rounded-2xl border border-border/60 bg-background-3/95 p-1.5 shadow-xl narrow-scrollbar"
          >
            <DropdownMenuLabel className="px-2 py-1.5 text-1 text-muted-foreground">
              {tNavigation('mySpaces')}
            </DropdownMenuLabel>
            {isAllSpacesLoading ? (
              <DropdownMenuItem disabled>{t('loading')}</DropdownMenuItem>
            ) : null}
            {!isAllSpacesLoading && allSpacesError ? (
              <DropdownMenuItem disabled>{t('streamError')}</DropdownMenuItem>
            ) : null}
            {!isAllSpacesLoading && !allSpacesError && !hasSpaces ? (
              <DropdownMenuItem disabled>{fallbackTitle}</DropdownMenuItem>
            ) : null}
            {!isAllSpacesLoading &&
              !allSpacesError &&
              hasSpaces &&
              groupedSpaces.ecosystem.map((space) => (
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
              ))}
            {!isAllSpacesLoading &&
            !allSpacesError &&
            groupedSpaces.ecosystem.length > 0 &&
            groupedSpaces.others.length > 0 ? (
              <DropdownMenuSeparator />
            ) : null}
            {!isAllSpacesLoading &&
              !allSpacesError &&
              hasSpaces &&
              groupedSpaces.others.map((space) => (
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
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {showCloseButton ? (
        <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center justify-end">
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
      ) : null}
    </div>
  );
}
