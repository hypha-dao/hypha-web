import type { Space } from '@hypha-platform/storage-postgres';

type GetSpaceById = (id: number) => Promise<Space | null>;

/**
 * Loads the ancestor chain as **root → … → leaf** (breadcrumb order) by following `parentId`.
 * Stops on missing parent, cycle, or `parentId === null`.
 */
export async function loadSpaceAncestorChain(
  leafSpaceId: number,
  getById: GetSpaceById,
): Promise<Space[]> {
  const rootToLeaf: Space[] = [];
  let current = await getById(leafSpaceId);
  if (!current) return [];

  const visited = new Set<number>();
  while (current) {
    if (visited.has(current.id)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          '[loadSpaceAncestorChain] cycle detected at space id',
          current.id,
        );
      }
      break;
    }
    visited.add(current.id);
    rootToLeaf.unshift(current);
    const parentId = current.parentId;
    if (parentId == null) break;
    current = await getById(parentId);
  }

  return rootToLeaf;
}
