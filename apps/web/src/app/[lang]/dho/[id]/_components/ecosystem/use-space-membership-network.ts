'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthentication } from '@hypha-platform/authentication';
import type { Space } from '@hypha-platform/core/client';
import { useFilterSpacesListWithDiscoverability } from '@hypha-platform/epics';
import { useMembers } from '../../../../../../hooks/use-members';
import { fetchSpaceMemberSpaces, mapPool } from './fetch-space-member-spaces';

export type SpaceMembershipEdge = {
  /** Parent space slug; null means the active hub. */
  parentSlug: string | null;
  parentId: number | null;
  child: Space;
  depth: number;
};

type UseSpaceMembershipNetworkArgs = {
  rootSlug: string;
  /** Org tree used so ORGANISATION discoverability can resolve. */
  organisationSpaces?: Space[];
  /** How many hops outward from the hub to auto-crawl. */
  maxDepth?: number;
  /** Hard cap on distinct space nodes (excluding hub). */
  maxNodes?: number;
  concurrency?: number;
};

/**
 * BFS-crawls space-to-space memberships from `rootSlug`, auto-expanding every
 * discoverable space up to `maxDepth` / `maxNodes`.
 */
export function useSpaceMembershipNetwork({
  rootSlug,
  organisationSpaces = [],
  maxDepth = 5,
  maxNodes = 140,
  concurrency = 4,
}: UseSpaceMembershipNetworkArgs) {
  const { getAccessToken } = useAuthentication();
  const { spaces: rootMembers, isLoading: isLoadingRoot } = useMembers({
    spaceSlug: rootSlug,
    paginationDisabled: true,
  });

  const [edges, setEdges] = useState<SpaceMembershipEdge[]>([]);
  const [isCrawling, setIsCrawling] = useState(false);
  const fetchedRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());
  const depthBySlugRef = useRef<Map<string, number>>(new Map());
  const crawlGenRef = useRef(0);
  const authHeadersRef = useRef<Record<string, string> | null>(null);
  const authHeadersGenRef = useRef(-1);

  // Stabilize roster identity so empty-array / same-content churn doesn't reset BFS.
  const rootRosterKey = useMemo(
    () =>
      JSON.stringify(
        (rootMembers.data ?? []).map((space) => [
          space.id,
          space.slug ?? '',
          space.web3SpaceId ?? null,
        ]),
      ),
    [rootMembers.data],
  );

  const rootMemberSpaces = useMemo(() => {
    void rootRosterKey;
    return rootMembers.data ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by rootRosterKey
  }, [rootRosterKey]);

  // Seed depth-1 edges whenever the root roster changes.
  useEffect(() => {
    crawlGenRef.current += 1;
    fetchedRef.current = new Set([rootSlug]);
    inFlightRef.current = new Set();
    depthBySlugRef.current = new Map([[rootSlug, 0]]);
    authHeadersRef.current = null;
    authHeadersGenRef.current = -1;

    const next: SpaceMembershipEdge[] = rootMemberSpaces.map((child) => ({
      parentSlug: null,
      parentId: null,
      child,
      depth: 1,
    }));
    for (const space of rootMemberSpaces) {
      if (space.slug) depthBySlugRef.current.set(space.slug, 1);
    }
    setEdges(next);
  }, [rootSlug, rootMemberSpaces]);

  const candidateSpaces = useMemo(() => {
    const byId = new Map<number, Space>();
    for (const space of organisationSpaces) byId.set(space.id, space);
    for (const edge of edges) byId.set(edge.child.id, edge.child);
    return Array.from(byId.values());
  }, [organisationSpaces, edges]);

  const { filteredSpaces, isLoading: isFiltering } =
    useFilterSpacesListWithDiscoverability({
      spaces: candidateSpaces,
      useGeneralState: true,
    });

  const discoverableIds = useMemo(() => {
    const ids = new Set<number>();
    for (const space of filteredSpaces ?? []) ids.add(space.id);
    // DB-only spaces (no web3 id) can't be transparency-checked — still expand.
    for (const edge of edges) {
      if (edge.child.web3SpaceId == null) ids.add(edge.child.id);
    }
    // Always treat first-hop members of the active space as visible.
    for (const space of rootMemberSpaces) ids.add(space.id);
    return ids;
  }, [filteredSpaces, edges, rootMemberSpaces]);

  // Auto-crawl discoverable frontiers.
  useEffect(() => {
    if (isFiltering || isLoadingRoot) return;

    const frontier: { slug: string; depth: number }[] = [];
    const seenFrontier = new Set<string>();

    const consider = (slug: string | undefined | null, depth: number) => {
      if (
        !slug ||
        fetchedRef.current.has(slug) ||
        inFlightRef.current.has(slug)
      )
        return;
      if (depth >= maxDepth) return;
      if (seenFrontier.has(slug)) return;
      seenFrontier.add(slug);
      frontier.push({ slug, depth });
    };

    for (const edge of edges) {
      if (!discoverableIds.has(edge.child.id)) continue;
      consider(edge.child.slug, edge.depth);
    }

    if (frontier.length === 0) return;

    const knownIds = new Set(edges.map((e) => e.child.id));
    if (knownIds.size >= maxNodes) return;

    const gen = crawlGenRef.current;
    let cancelled = false;

    const run = async () => {
      setIsCrawling(true);
      try {
        if (
          authHeadersGenRef.current !== gen ||
          authHeadersRef.current == null
        ) {
          const token = await getAccessToken();
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          if (token) headers.Authorization = `Bearer ${token}`;
          authHeadersRef.current = headers;
          authHeadersGenRef.current = gen;
        }
        const headers = authHeadersRef.current;

        const batch = frontier.slice(0, concurrency);
        for (const item of batch) inFlightRef.current.add(item.slug);

        const results = await mapPool(batch, concurrency, async (item) => {
          try {
            const members = await fetchSpaceMemberSpaces(item.slug, headers);
            return { ...item, members };
          } catch {
            return { ...item, members: [] as Space[] };
          }
        });

        if (cancelled || gen !== crawlGenRef.current) {
          // Keep slugs in fetched so cancelled batches are not immediately re-queued.
          for (const item of batch) {
            inFlightRef.current.delete(item.slug);
            fetchedRef.current.add(item.slug);
          }
          return;
        }

        for (const item of batch) {
          inFlightRef.current.delete(item.slug);
          fetchedRef.current.add(item.slug);
        }

        setEdges((prev) => {
          const known = new Set(prev.map((e) => e.child.id));
          const seenPairs = new Set(
            prev.map(
              (e) => `${e.parentSlug ?? ''}|${e.parentId ?? ''}|${e.child.id}`,
            ),
          );
          const next = [...prev];

          resultsLoop: for (const { slug, depth, members } of results) {
            if (known.size >= maxNodes) break resultsLoop;

            const parentSpace =
              prev.find((e) => e.child.slug === slug)?.child ??
              organisationSpaces.find((s) => s.slug === slug);
            const parentId = parentSpace?.id ?? null;

            for (const child of members) {
              if (child.slug === rootSlug) continue;
              if (known.size >= maxNodes) break resultsLoop;

              const pairKey = `${slug}|${parentId ?? ''}|${child.id}`;
              if (seenPairs.has(pairKey)) {
                known.add(child.id);
                continue;
              }
              seenPairs.add(pairKey);
              if (!known.has(child.id)) known.add(child.id);

              const childDepth = depth + 1;
              if (child.slug) {
                const prevDepth = depthBySlugRef.current.get(child.slug);
                if (prevDepth == null || childDepth < prevDepth) {
                  depthBySlugRef.current.set(child.slug, childDepth);
                }
              }
              next.push({
                parentSlug: slug,
                parentId,
                child,
                depth: childDepth,
              });
            }
          }

          return next;
        });
      } finally {
        if (gen === crawlGenRef.current) {
          setIsCrawling(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    edges,
    discoverableIds,
    isFiltering,
    isLoadingRoot,
    maxDepth,
    maxNodes,
    concurrency,
    getAccessToken,
    rootSlug,
    organisationSpaces,
  ]);

  const visibleEdges = useMemo(
    () =>
      edges.filter(
        (edge) => edge.depth === 1 || discoverableIds.has(edge.child.id),
      ),
    [edges, discoverableIds],
  );

  const spaceCount = useMemo(() => {
    const ids = new Set<number>();
    for (const edge of visibleEdges) {
      if (discoverableIds.has(edge.child.id) || edge.depth === 1) {
        ids.add(edge.child.id);
      }
    }
    return ids.size;
  }, [visibleEdges, discoverableIds]);

  return {
    edges: visibleEdges,
    discoverableIds,
    spaceCount,
    isLoading: isLoadingRoot || isFiltering,
    isCrawling,
    maxDepth,
    maxNodes,
  };
}
