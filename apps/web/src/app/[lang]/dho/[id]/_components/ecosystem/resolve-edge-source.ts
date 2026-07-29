import type { Space } from '@hypha-platform/core/client';
import type { SpaceMembershipEdge } from './use-space-membership-network';

type EnsureSpace = (space: Space, depth: number) => string;

/**
 * Resolve the source node id for a membership edge: hub, cached parent, or
 * lazily materialize the parent via `ensureSpace` when allowed.
 */
export function resolveEdgeSource(args: {
  edge: SpaceMembershipEdge;
  edges: SpaceMembershipEdge[];
  hubId: string;
  spaceIdToNode: Map<number, string>;
  ensureSpace: EnsureSpace;
  /** When false, undiscoverable parents fall back to hub instead of materializing. */
  canMaterializeParent?: (space: Space) => boolean;
}): string {
  const {
    edge,
    edges,
    hubId,
    spaceIdToNode,
    ensureSpace,
    canMaterializeParent,
  } = args;

  if (edge.parentSlug == null || edge.parentId == null) return hubId;

  const cached = spaceIdToNode.get(edge.parentId);
  if (cached) return cached;

  const parentById = new Map<number, SpaceMembershipEdge>();
  for (const candidate of edges) {
    parentById.set(candidate.child.id, candidate);
  }
  const parentEdge = parentById.get(edge.parentId);
  if (!parentEdge) return hubId;
  if (canMaterializeParent && !canMaterializeParent(parentEdge.child)) {
    return hubId;
  }
  return ensureSpace(parentEdge.child, parentEdge.depth);
}
