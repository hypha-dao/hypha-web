'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import { Space } from '@hypha-platform/core/client';
import { useFilterSpacesListWithDiscoverability } from '@hypha-platform/epics';
import { useMembers } from '../../../../../../hooks/use-members';
import { useTranslations } from 'next-intl';
import { MyceliumForceGraph } from './mycelium-force-graph';
import type { MyceliumGraph, MyceliumNode } from './types';
import { fetchSpaceMemberSpaces, mapPool } from './fetch-space-member-spaces';
import { useSpaceMembershipNetwork } from './use-space-membership-network';

type MemberConnectionsViewProps = {
  spaceSlug: string;
  spaceTitle: string;
  spaceLogoUrl?: string | null;
  /** Full org tree — needed so organisation-level discoverability can resolve. */
  organisationSpaces?: Space[];
  accentHex?: string;
  onVisitSpace?: (slug: string) => void;
  /** Compact layout when embedded inside Nested Spaces. */
  compact?: boolean;
};

const MAX_PEOPLE = 40;
const CONCURRENCY = 4;

export function MemberConnectionsView({
  spaceSlug,
  spaceTitle,
  spaceLogoUrl,
  organisationSpaces = [],
  accentHex,
  onVisitSpace,
  compact = false,
}: MemberConnectionsViewProps) {
  const t = useTranslations('SelectNavigationAction');
  const { getAccessToken } = useAuthentication();
  const { persons, isLoading: isLoadingMembers } = useMembers({
    spaceSlug,
    paginationDisabled: true,
  });
  const [personSpaces, setPersonSpaces] = useState<Map<string, Space[]>>(
    new Map(),
  );
  const [isLoadingSpaces, setIsLoadingSpaces] = useState(false);

  const people = useMemo(
    () => (persons.data ?? []).slice(0, MAX_PEOPLE),
    [persons.data],
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (people.length === 0) {
        setPersonSpaces(new Map());
        return;
      }
      setIsLoadingSpaces(true);
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const pairs = await mapPool(people, CONCURRENCY, async (person) => {
          if (!person.slug) return [String(person.id), [] as Space[]] as const;
          try {
            const res = await fetch(
              `/api/v1/people/${encodeURIComponent(person.slug)}/spaces`,
              { headers },
            );
            if (!res.ok) return [String(person.id), [] as Space[]] as const;
            const spaces = (await res.json()) as Space[];
            return [String(person.id), spaces] as const;
          } catch {
            return [String(person.id), [] as Space[]] as const;
          }
        });

        if (cancelled) return;
        setPersonSpaces(new Map(pairs));
      } finally {
        if (!cancelled) setIsLoadingSpaces(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [people, getAccessToken]);

  const allConnectedSpaces = useMemo(() => {
    const byId = new Map<number, Space>();
    for (const spaces of personSpaces.values()) {
      for (const space of spaces) {
        if (space.slug === spaceSlug) continue;
        byId.set(space.id, space);
      }
    }
    return Array.from(byId.values());
  }, [personSpaces, spaceSlug]);

  const spacesForDiscoverability = useMemo(() => {
    const byId = new Map<number, Space>();
    for (const space of organisationSpaces) byId.set(space.id, space);
    for (const space of allConnectedSpaces) byId.set(space.id, space);
    return Array.from(byId.values());
  }, [organisationSpaces, allConnectedSpaces]);

  const { filteredSpaces, isLoading: isFiltering } =
    useFilterSpacesListWithDiscoverability({
      spaces: spacesForDiscoverability,
      useGeneralState: true,
    });

  const discoverableIds = useMemo(() => {
    const connectedIds = new Set(allConnectedSpaces.map((space) => space.id));
    const ids = new Set<number>();
    for (const space of filteredSpaces ?? []) {
      if (connectedIds.has(space.id)) ids.add(space.id);
    }
    for (const space of allConnectedSpaces) {
      if (space.web3SpaceId == null) ids.add(space.id);
    }
    return ids;
  }, [filteredSpaces, allConnectedSpaces]);

  // Grow the map outward through space-to-space memberships from this hub.
  const {
    edges: networkEdges,
    discoverableIds: networkDiscoverableIds,
    isLoading: isLoadingNetwork,
    isCrawling,
  } = useSpaceMembershipNetwork({
    rootSlug: spaceSlug,
    organisationSpaces,
    maxDepth: compact ? 3 : 5,
    maxNodes: compact ? 60 : 120,
  });

  // Also crawl one hop from person-linked spaces that aren't on the hub roster.
  const [extraEdges, setExtraEdges] = useState<
    { parentId: number; child: Space }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const seeds = allConnectedSpaces.filter(
        (space) =>
          space.slug &&
          discoverableIds.has(space.id) &&
          space.slug !== spaceSlug,
      );
      if (seeds.length === 0) {
        setExtraEdges([]);
        return;
      }
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const results = await mapPool(
          seeds.slice(0, 24),
          CONCURRENCY,
          async (space) => {
            try {
              const members = await fetchSpaceMemberSpaces(
                space.slug!,
                headers,
              );
              return members.map((child) => ({
                parentId: space.id,
                child,
              }));
            } catch {
              return [] as { parentId: number; child: Space }[];
            }
          },
        );
        if (cancelled) return;
        setExtraEdges(results.flat());
      } catch {
        if (!cancelled) setExtraEdges([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [allConnectedSpaces, discoverableIds, getAccessToken, spaceSlug]);

  const graph = useMemo<MyceliumGraph>(() => {
    const nodes: MyceliumNode[] = [
      {
        id: `hub-${spaceSlug}`,
        kind: 'hub',
        label: spaceTitle,
        imageUrl: spaceLogoUrl,
        meta: t('memberConnections.hubMeta'),
      },
    ];
    const links: MyceliumGraph['links'] = [];
    const spaceNodes = new Map<number, string>();
    const seenLinks = new Set<string>();

    const ensureSpace = (space: Space, meta: string) => {
      let spaceNodeId = spaceNodes.get(space.id);
      if (!spaceNodeId) {
        spaceNodeId = `space-${space.id}`;
        spaceNodes.set(space.id, spaceNodeId);
        nodes.push({
          id: spaceNodeId,
          kind: 'space',
          label: space.title,
          imageUrl: space.logoUrl,
          slug: space.slug,
          meta,
        });
      }
      return spaceNodeId;
    };

    const addLink = (
      id: string,
      source: string,
      target: string,
      strength: number,
      weight?: number,
    ) => {
      const key = `${source}->${target}`;
      if (seenLinks.has(key)) return;
      seenLinks.add(key);
      links.push({ id, source, target, strength, weight });
    };

    for (const person of people) {
      const personId = `person-${person.id}`;
      const label =
        [person.name, person.surname].filter(Boolean).join(' ') ||
        person.nickname ||
        person.slug ||
        'Member';
      nodes.push({
        id: personId,
        kind: 'person',
        label,
        imageUrl: person.avatarUrl,
        slug: person.slug,
        meta: t('memberConnections.personMeta'),
      });
      addLink(`link-hub-${person.id}`, `hub-${spaceSlug}`, personId, 0.7);

      const spaces = personSpaces.get(String(person.id)) ?? [];
      for (const space of spaces) {
        if (space.slug === spaceSlug) continue;
        if (!discoverableIds.has(space.id)) continue;
        const spaceNodeId = ensureSpace(
          space,
          t('memberConnections.spaceMeta'),
        );
        addLink(
          `link-${person.id}-${space.id}`,
          personId,
          spaceNodeId,
          0.45,
          0.55,
        );
      }
    }

    // Hub space-to-space network (full mycelium outward).
    for (const edge of networkEdges) {
      if (!(edge.depth === 1 || networkDiscoverableIds.has(edge.child.id))) {
        continue;
      }
      const childId = ensureSpace(
        edge.child,
        t('memberConnections.networkSpaceMeta', { depth: edge.depth }),
      );
      const sourceId =
        edge.parentSlug == null || edge.parentId == null
          ? `hub-${spaceSlug}`
          : spaceNodes.get(edge.parentId) ??
            (() => {
              const parent = networkEdges.find(
                (e) => e.child.id === edge.parentId,
              )?.child;
              return parent
                ? ensureSpace(
                    parent,
                    t('memberConnections.networkSpaceMeta', {
                      depth: edge.depth - 1,
                    }),
                  )
                : `hub-${spaceSlug}`;
            })();

      addLink(
        `net-${sourceId}-${childId}-${edge.depth}`,
        sourceId,
        childId,
        Math.max(0.25, 0.8 - edge.depth * 0.1),
        Math.max(0.25, 1 - (edge.depth - 1) * 0.12),
      );
    }

    // Extra hops from person-linked spaces.
    for (const edge of extraEdges) {
      if (edge.child.slug === spaceSlug) continue;
      const parentNode = spaceNodes.get(edge.parentId);
      if (!parentNode) continue;
      const canShow =
        edge.child.web3SpaceId == null ||
        networkDiscoverableIds.has(edge.child.id) ||
        discoverableIds.has(edge.child.id);
      if (!canShow) continue;
      const childId = ensureSpace(
        edge.child,
        t('memberConnections.networkSpaceMeta', { depth: 2 }),
      );
      addLink(
        `extra-${edge.parentId}-${edge.child.id}`,
        parentNode,
        childId,
        0.35,
        0.4,
      );
    }

    return { nodes, links };
  }, [
    people,
    personSpaces,
    discoverableIds,
    networkEdges,
    networkDiscoverableIds,
    extraEdges,
    spaceSlug,
    spaceTitle,
    spaceLogoUrl,
    t,
  ]);

  const handleNodeClick = useCallback(
    (node: MyceliumNode) => {
      if (node.slug && node.kind === 'space') {
        onVisitSpace?.(node.slug);
      }
    },
    [onVisitSpace],
  );

  const isLoading =
    isLoadingMembers ||
    isLoadingSpaces ||
    isFiltering ||
    isLoadingNetwork ||
    isCrawling;
  const linkedSpaceCount = useMemo(() => {
    return graph.nodes.filter((n) => n.kind === 'space').length;
  }, [graph.nodes]);

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h3
            className={
              compact
                ? 'text-2 font-semibold text-foreground'
                : 'text-3 font-semibold text-foreground'
            }
          >
            {t('memberConnections.title')}
          </h3>
          {!compact ? (
            <p className="mt-0.5 max-w-2xl text-1 text-muted-foreground">
              {t('memberConnections.description')}
            </p>
          ) : (
            <p className="mt-0.5 max-w-2xl text-1 text-muted-foreground">
              {t('memberConnections.embeddedDescription', {
                space: spaceTitle,
              })}
            </p>
          )}
        </div>
        <p className="text-1 text-muted-foreground">
          {isLoading
            ? t('visibleSpaces.loading')
            : t('memberConnections.stats', {
                people: people.length,
                spaces: linkedSpaceCount,
              })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-1 text-1 text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-current opacity-70" />
          {t('memberConnections.legendPerson')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-[3px] bg-current opacity-70" />
          {t('memberConnections.legendSpace')}
        </span>
      </div>
      <MyceliumForceGraph
        graph={graph}
        accentHex={accentHex}
        emptyLabel={t('memberConnections.empty')}
        onNodeClick={handleNodeClick}
      />
    </div>
  );
}
