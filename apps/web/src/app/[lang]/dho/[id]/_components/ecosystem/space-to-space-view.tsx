'use client';

import { useCallback, useMemo } from 'react';
import type { Space } from '@hypha-platform/core/client';
import { useTranslations } from 'next-intl';
import { MyceliumForceGraph } from './mycelium-force-graph';
import { resolveEdgeSource } from './resolve-edge-source';
import type { MyceliumGraph, MyceliumNode } from './types';
import { useSpaceMembershipNetwork } from './use-space-membership-network';

type SpaceToSpaceViewProps = {
  spaceSlug: string;
  spaceTitle: string;
  spaceLogoUrl?: string | null;
  organisationSpaces?: Space[];
  accentHex?: string;
  onVisitSpace?: (slug: string) => void;
};

export function SpaceToSpaceView({
  spaceSlug,
  spaceTitle,
  spaceLogoUrl,
  organisationSpaces = [],
  accentHex,
  onVisitSpace,
}: SpaceToSpaceViewProps) {
  const t = useTranslations('SelectNavigationAction');
  const { edges, discoverableIds, spaceCount, isLoading, isCrawling } =
    useSpaceMembershipNetwork({
      rootSlug: spaceSlug,
      organisationSpaces,
      maxDepth: 5,
      maxNodes: 140,
    });

  const graph = useMemo<MyceliumGraph>(() => {
    const nodes: MyceliumNode[] = [
      {
        id: `hub-${spaceSlug}`,
        kind: 'hub',
        label: spaceTitle,
        imageUrl: spaceLogoUrl,
        meta: t('spaceToSpace.hubMeta'),
      },
    ];
    const links: MyceliumGraph['links'] = [];
    const seenLinks = new Set<string>();
    const nodeIds = new Set<string>([`hub-${spaceSlug}`]);
    const spaceIdToNode = new Map<number, string>();
    const hubId = `hub-${spaceSlug}`;

    const ensureSpaceNode = (space: Space, depth: number) => {
      const id = `space-${space.id}`;
      if (nodeIds.has(id)) return id;
      nodeIds.add(id);
      spaceIdToNode.set(space.id, id);
      const isDiscoverable = discoverableIds.has(space.id);
      nodes.push({
        id,
        kind: 'space',
        label: space.title,
        imageUrl: space.logoUrl,
        slug: space.slug,
        meta: isDiscoverable
          ? t('spaceToSpace.networkMeta', { depth })
          : t('spaceToSpace.privateMeta'),
      });
      return id;
    };

    for (const edge of edges) {
      if (!(edge.depth === 1 || discoverableIds.has(edge.child.id))) continue;

      const childId = ensureSpaceNode(edge.child, edge.depth);
      const sourceId = resolveEdgeSource({
        edge,
        edges,
        hubId,
        spaceIdToNode,
        ensureSpace: ensureSpaceNode,
        canMaterializeParent: (space) => {
          const parentEdge = edges.find((e) => e.child.id === space.id);
          return parentEdge
            ? parentEdge.depth === 1 || discoverableIds.has(space.id)
            : discoverableIds.has(space.id);
        },
      });

      if (!nodeIds.has(sourceId)) continue;

      const linkKey = `${sourceId}->${childId}@${edge.depth}`;
      if (seenLinks.has(linkKey)) continue;
      seenLinks.add(linkKey);

      links.push({
        id: `edge-${sourceId}-${childId}-${edge.depth}`,
        source: sourceId,
        target: childId,
        strength: Math.max(0.25, 0.85 - edge.depth * 0.12),
        weight: Math.max(0.2, 1 - (edge.depth - 1) * 0.15),
        label:
          edge.depth === 1
            ? t('spaceToSpace.membership')
            : t('spaceToSpace.nestedMembership'),
      });
    }

    return { nodes, links };
  }, [edges, discoverableIds, spaceSlug, spaceTitle, spaceLogoUrl, t]);

  const handleClick = useCallback(
    (node: MyceliumNode) => {
      if (node.slug && node.kind === 'space') onVisitSpace?.(node.slug);
    },
    [onVisitSpace],
  );

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2 px-1">
        <div>
          <h3 className="text-3 font-semibold text-foreground">
            {t('spaceToSpace.title')}
          </h3>
          <p className="mt-0.5 max-w-2xl text-1 text-muted-foreground">
            {t('spaceToSpace.description')}
          </p>
        </div>
        <p className="text-1 text-muted-foreground">
          {isLoading
            ? t('visibleSpaces.loading')
            : isCrawling
            ? t('spaceToSpace.expanding')
            : t('spaceToSpace.stats', {
                spaces: spaceCount,
                links: graph.links.length,
              })}
        </p>
      </div>
      <MyceliumForceGraph
        graph={graph}
        accentHex={accentHex}
        ariaLabel={t('spaceToSpace.graphAria')}
        emptyLabel={t('spaceToSpace.empty')}
        onNodeClick={handleClick}
      />
    </div>
  );
}
