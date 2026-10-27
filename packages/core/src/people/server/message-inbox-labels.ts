export type MessageInboxSpaceNode = {
  id: number;
  slug: string;
  title: string;
  parentId: number | null;
  chatRoomId: string | null;
};

export type MessageInboxSpaceLabel = MessageInboxSpaceNode & {
  rootSlug: string;
  rootTitle: string;
};

function rootOf(
  space: MessageInboxSpaceNode,
  byId: ReadonlyMap<number, MessageInboxSpaceNode>,
): MessageInboxSpaceNode {
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

/** Attach each space's ecosystem root. Stops when a parent is not in the map. */
export function labelInboxSpaces(
  nodes: readonly MessageInboxSpaceNode[],
  memberIds?: ReadonlySet<number>,
): MessageInboxSpaceLabel[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return nodes.flatMap((node) => {
    if (memberIds && !memberIds.has(node.id)) return [];
    const root = rootOf(node, byId);
    return [
      {
        ...node,
        rootSlug: root.slug,
        rootTitle: root.title,
      },
    ];
  });
}
