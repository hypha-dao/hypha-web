type EcosystemSpace = {
  id: number;
  slug: string;
  parentId?: number | null;
};

export type SpaceEcosystemGroup<T extends EcosystemSpace> = {
  rootId: number;
  spaces: T[];
};

function recentRank(slug: string, recentSlugs: string[]) {
  const index = recentSlugs.indexOf(slug);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

/** Walk parent links inside the loaded set; fall back to the missing parent id. */
export function ecosystemRootId(
  space: EcosystemSpace,
  byId: Map<number, EcosystemSpace>,
): number {
  let current = space;
  const seen = new Set<number>();
  while (current.parentId != null && !seen.has(current.id)) {
    seen.add(current.id);
    const parent = byId.get(current.parentId);
    if (!parent) return current.parentId;
    current = parent;
  }
  return current.id;
}

function sortWithinEcosystemGroup<T extends EcosystemSpace>(
  members: T[],
  rootId: number,
  recentSlugs: string[],
): T[] {
  const root = members.find((space) => space.id === rootId);
  const rest = members
    .filter((space) => space.id !== rootId)
    .sort((a, b) => {
      const byRecent =
        recentRank(a.slug, recentSlugs) - recentRank(b.slug, recentSlugs);
      if (byRecent !== 0) return byRecent;
      return a.id - b.id;
    });
  return root ? [root, ...rest] : rest;
}

/**
 * Ecosystems ordered by the most recent visit in the group. Root space first
 * inside each group; remaining spaces follow visit order.
 */
export function groupSpacesByEcosystemRecency<T extends EcosystemSpace>(
  spaces: readonly T[],
  recentSlugs: string[],
): SpaceEcosystemGroup<T>[] {
  if (spaces.length === 0) return [];
  const byId = new Map(spaces.map((space) => [space.id, space]));
  const buckets = new Map<number, T[]>();
  for (const space of spaces) {
    const rootId = ecosystemRootId(space, byId);
    const bucket = buckets.get(rootId) ?? [];
    bucket.push(space);
    buckets.set(rootId, bucket);
  }

  const groups: SpaceEcosystemGroup<T>[] = [];
  for (const [rootId, members] of buckets) {
    groups.push({
      rootId,
      spaces: sortWithinEcosystemGroup(members, rootId, recentSlugs),
    });
  }

  groups.sort((a, b) => {
    const aRank = Math.min(
      ...a.spaces.map((space) => recentRank(space.slug, recentSlugs)),
    );
    const bRank = Math.min(
      ...b.spaces.map((space) => recentRank(space.slug, recentSlugs)),
    );
    if (aRank !== bRank) return aRank - bRank;
    return a.rootId - b.rootId;
  });

  return groups;
}

export function flattenEcosystemSpaceGroups<T extends EcosystemSpace>(
  groups: readonly SpaceEcosystemGroup<T>[],
): T[] {
  return groups.flatMap((group) => group.spaces);
}

/** @deprecated Prefer {@link groupSpacesByEcosystemRecency}; kept for callers that need a flat list. */
export function orderSpacesByRecentVisit<T extends EcosystemSpace>(
  spaces: readonly T[],
  recentSlugs: string[],
): T[] {
  return flattenEcosystemSpaceGroups(
    groupSpacesByEcosystemRecency(spaces, recentSlugs),
  );
}
