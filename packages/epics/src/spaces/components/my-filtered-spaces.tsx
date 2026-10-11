'use client';

import { Locale } from '@hypha-platform/i18n';
import {
  Address,
  Space,
  SpaceOrder,
  isSpaceArchived,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import type { ReactNode } from 'react';
import { SpaceCardList } from './space-card-list';
import { SpaceCardContainer } from './space-card.container';
import { resolveSpaceDisplayLogoUrl } from '../utils/resolve-space-display-logo-url';
import { Avatar, AvatarFallback, AvatarImage } from '@hypha-platform/ui';
import { useMemberWeb3SpaceIds } from '../hooks/use-member-web3-space-ids';
import { useMe } from '@hypha-platform/core/client';
import React from 'react';
import { Text } from '@radix-ui/themes';
import { useFilterSpacesListWithDiscoverability } from '../hooks/use-spaces-discoverability-batch';
import { Checkbox } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { SpaceOrderCombobox } from './space-order-combobox';

export function filterSpaces(
  spaces: Space[],
  personSlug: string | undefined,
  web3SpaceIds: readonly bigint[] | undefined,
) {
  if (!personSlug || !web3SpaceIds) {
    return [];
  }
  const userSpaces: Space[] = spaces.filter((space) => {
    const spaceId = space.web3SpaceId ? BigInt(space.web3SpaceId) : null;
    return spaceId !== null && web3SpaceIds.includes(spaceId);
  });
  return userSpaces;
}

function spaceMatchesQuery(space: Space, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    space.title.toLowerCase().includes(q) ||
    (space.slug ?? '').toLowerCase().includes(q)
  );
}

function findRootSpace(space: Space, byId: Map<number, Space>): Space {
  let current = space;
  const seen = new Set<number>();
  while (current.parentId != null && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current;
}

type EcosystemGroup = {
  root: Space;
  spaces: Space[];
};

function groupSpacesByEcosystem(
  memberSpaces: Space[],
  catalog: Space[],
  order: SpaceOrder | undefined,
  query: string,
): EcosystemGroup[] {
  const byId = new Map(catalog.map((space) => [space.id, space]));
  const groups = new Map<number, { root: Space; members: Space[] }>();
  for (const space of memberSpaces) {
    const root = findRootSpace(space, byId);
    const group = groups.get(root.id) ?? { root, members: [] };
    group.members.push(space);
    groups.set(root.id, group);
  }

  const q = query.trim();
  const built: EcosystemGroup[] = [];
  for (const group of groups.values()) {
    const rootMatches = q ? spaceMatchesQuery(group.root, q) : true;
    const matchingMembers = q
      ? group.members.filter((space) => spaceMatchesQuery(space, q))
      : group.members;
    if (!rootMatches && matchingMembers.length === 0) continue;
    const visible = rootMatches ? group.members : matchingMembers;
    const sorted = sortSpacesByOrder(visible, order);
    const rootCard = sorted.find((space) => space.id === group.root.id);
    const rest = sorted.filter((space) => space.id !== group.root.id);
    built.push({
      root: group.root,
      spaces: rootCard ? [rootCard, ...rest] : rest,
    });
  }

  const rootOrder = new Map(
    sortSpacesByOrder(
      built.map((group) => group.root),
      order,
    ).map((space, index) => [space.id, index]),
  );
  return built.sort(
    (a, b) => (rootOrder.get(a.root.id) ?? 0) - (rootOrder.get(b.root.id) ?? 0),
  );
}

function sortSpacesByOrder(spaces: Space[], order?: SpaceOrder): Space[] {
  const compareMembers = (a: Space, b: Space) => {
    const aCount = a.memberAddresses?.length ?? a.memberCount ?? 0;
    const bCount = b.memberAddresses?.length ?? b.memberCount ?? 0;
    return bCount - aCount;
  };
  const compareAgreements = (a: Space, b: Space) =>
    (b.documentCount ?? 0) - (a.documentCount ?? 0);
  const compareRecent = (a: Space, b: Space) => b.id - a.id;

  return [...spaces].sort((a, b) => {
    switch (order) {
      case 'mostmembers':
        return compareMembers(a, b);
      case 'mostagreements':
        return compareAgreements(a, b);
      case 'mostrecent':
        return compareRecent(a, b);
      default:
        return compareMembers(a, b);
    }
  });
}

export function MyFilteredSpaces({
  lang,
  spaces,
  order,
  query = '',
  renderDiagram,
}: {
  lang: Locale;
  spaces: Space[];
  order?: SpaceOrder;
  query?: string;
  renderDiagram?: (root: Space) => ReactNode;
}) {
  const { person, isLoading: isLoadingPerson } = useMe();
  const { web3SpaceIds, isLoading: isLoadingMemberSpaceIds } =
    useMemberWeb3SpaceIds({
      personAddress: person?.address as Address | undefined,
    });
  const [hideArchivedSpaces, setHideArchivedSpaces] = React.useState(true);
  const [diagramRootIds, setDiagramRootIds] = React.useState<
    ReadonlySet<number>
  >(() => new Set());
  const tSpaces = useTranslations('Spaces');
  const tMyWallet = useTranslations('MyWallet');

  const memberFilteredSpaces = React.useMemo(
    () => filterSpaces(spaces, person?.slug, web3SpaceIds),
    [spaces, person, web3SpaceIds],
  );

  const { filteredSpaces, isLoading: isDiscoverabilityLoading } =
    useFilterSpacesListWithDiscoverability({
      spaces: memberFilteredSpaces,
      useGeneralState: false,
    });

  const isLoadingSpaces =
    isLoadingPerson ||
    (Boolean(person?.address) && isLoadingMemberSpaceIds) ||
    isDiscoverabilityLoading;

  const ecosystemGroups = React.useMemo(() => {
    const visibleSpaces = hideArchivedSpaces
      ? filteredSpaces.filter((space) => !isSpaceArchived(space))
      : filteredSpaces;
    return groupSpacesByEcosystem(visibleSpaces, spaces, order, query);
  }, [filteredSpaces, hideArchivedSpaces, spaces, order, query]);
  const displayedCount = ecosystemGroups.reduce(
    (count, group) => count + group.spaces.length,
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex w-full min-w-0 flex-col gap-3 md:flex-row md:flex-nowrap md:items-center md:gap-x-3 md:overflow-x-auto">
        <Text className="min-w-0 text-4 capitalize md:shrink md:text-nowrap">
          {tSpaces('mySpacesLabel')}
          {isLoadingSpaces ? null : ` | ${displayedCount}`}
        </Text>
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 md:ml-auto md:shrink-0 md:flex-nowrap">
          <label
            htmlFor="hide-archived-spaces"
            className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap"
          >
            <Checkbox
              id="hide-archived-spaces"
              checked={hideArchivedSpaces}
              onCheckedChange={(checked) =>
                setHideArchivedSpaces(checked === true)
              }
            />
            <span className="whitespace-nowrap text-2 font-normal text-neutral-11">
              {tSpaces('hideArchivedSpaces')}
            </span>
          </label>
          <SpaceOrderCombobox order={order} className="shrink-0" />
        </div>
      </div>
      {isLoadingSpaces ? (
        <Text className="text-3 text-muted-foreground">
          {tMyWallet('loading')}
        </Text>
      ) : ecosystemGroups.length === 0 ? (
        <SpaceCardList
          lang={lang}
          spaces={[]}
          showLoadMore={false}
          showExitButton={true}
        />
      ) : (
        <div className="flex flex-col gap-8">
          {ecosystemGroups.map((group) => {
            const logo = resolveSpaceDisplayLogoUrl(group.root);
            const initial = group.root.title.trim().charAt(0).toUpperCase();
            const showDiagram =
              Boolean(renderDiagram) &&
              Boolean(group.root.slug) &&
              diagramRootIds.has(group.root.id);
            return (
              <section key={group.root.id} className="flex flex-col gap-3">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <h2 className="flex min-w-0 items-center gap-2.5">
                    <Avatar className="size-8 shrink-0 rounded-none">
                      {logo ? (
                        <AvatarImage
                          src={logo}
                          alt=""
                          className="object-cover"
                        />
                      ) : null}
                      <AvatarFallback className="rounded-none text-1">
                        {initial}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 truncate text-4 font-medium">
                      {group.root.title}
                    </span>
                  </h2>
                  {renderDiagram && group.root.slug ? (
                    <div
                      role="group"
                      aria-label={tSpaces('viewToggleLabel')}
                      className="inline-flex shrink-0 border border-foreground"
                    >
                      {(['spaces', 'diagram'] as const).map((option) => {
                        const selected =
                          option === 'diagram' ? showDiagram : !showDiagram;
                        return (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => {
                              setDiagramRootIds((current) => {
                                const next = new Set(current);
                                if (option === 'diagram') {
                                  next.add(group.root.id);
                                } else {
                                  next.delete(group.root.id);
                                }
                                return next;
                              });
                            }}
                            className={cn(
                              'px-3 py-1 text-1 uppercase tracking-[0.12em]',
                              selected
                                ? 'bg-foreground text-background'
                                : 'bg-background text-foreground',
                            )}
                          >
                            {option === 'diagram'
                              ? tSpaces('viewDiagram')
                              : tSpaces('viewSpaces')}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
                {showDiagram && renderDiagram ? (
                  renderDiagram(group.root)
                ) : (
                  <SpaceCardContainer
                    lang={lang}
                    spaces={group.spaces}
                    showExitButton={true}
                    gridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
                  />
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
