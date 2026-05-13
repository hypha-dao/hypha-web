import { Space } from '@hypha-platform/core/client';

export function getRootSpace(
  activeSpace?: Space,
  spaces: Space[] = [],
): Space | null {
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
