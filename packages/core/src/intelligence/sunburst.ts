import { extractLinkedSignalSlug } from './graph';

export const SIGNAL_SUNBURST_UNCATEGORIZED_ID = 'uncategorized' as const;

/** Distinct slice colors by board order (workflow tokens often repeat). */
export const SUNBURST_BOARD_PALETTE = [
  '#64748b',
  '#3b82f6',
  '#8b5cf6',
  '#06b6d4',
  '#22c55e',
  '#f59e0b',
  '#ec4899',
  '#ef4444',
  '#14b8a6',
  '#f97316',
] as const;

export type IntelligenceSunburstKind =
  | 'root'
  | 'category'
  | 'signal'
  | 'artifact'
  | 'file';

export type IntelligenceSunburstNode = {
  id: string;
  name: string;
  kind: IntelligenceSunburstKind;
  categoryId?: string;
  color?: string;
  slug?: string;
  href?: string;
  artifactId?: string;
  value?: number;
  children?: IntelligenceSunburstNode[];
};

export type SunburstSignalInput = {
  slug: string;
  title: string;
  board?: string | null;
};

export type SunburstArtifactInput = {
  id: string;
  title: string;
  linked_signals?: string[];
};

export type SunburstFileInput = {
  id: string | number;
  title: string;
  linked_artifact_id: string;
  slug?: string | null;
  href?: string;
};

export type SunburstBoardInput = {
  slug: string;
  name: string;
  color?: string;
  position?: number;
  archived?: boolean;
};

export function sunburstBoardColor(
  slug: string,
  boards: readonly SunburstBoardInput[],
): string {
  const index = boards.findIndex((board) => board.slug === slug);
  const paletteIndex = index >= 0 ? index : hashSlug(slug);
  return (
    SUNBURST_BOARD_PALETTE[paletteIndex % SUNBURST_BOARD_PALETTE.length] ??
    SUNBURST_BOARD_PALETTE[0]
  );
}

function hashSlug(slug: string): number {
  let hash = 0;
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function resolveSunburstBoard(
  board: string | null | undefined,
  boards: readonly SunburstBoardInput[],
  defaultBoard: string,
): string {
  const trimmed = board?.trim();
  if (trimmed) {
    const exists = boards.some(
      (item) => item.slug === trimmed && !item.archived,
    );
    if (exists) return trimmed;
    if (boards.length === 0) return trimmed;
  }
  if (
    defaultBoard &&
    (boards.length === 0 ||
      boards.some((item) => item.slug === defaultBoard && !item.archived))
  ) {
    return defaultBoard;
  }
  return SIGNAL_SUNBURST_UNCATEGORIZED_ID;
}

function asLeaf(node: IntelligenceSunburstNode): IntelligenceSunburstNode {
  if (node.children && node.children.length > 0) return node;
  return { ...node, value: 1, children: undefined };
}

function filesForArtifact(
  artifactId: string,
  filesByArtifact: Map<string, SunburstFileInput[]>,
): IntelligenceSunburstNode[] {
  return (filesByArtifact.get(artifactId) ?? []).map((file) =>
    asLeaf({
      id: `file:${file.id}`,
      name: file.title.trim() || String(file.id),
      kind: 'file',
      slug: file.slug?.trim() || undefined,
      href: file.href?.trim() || undefined,
      artifactId,
    }),
  );
}

function artifactNode(
  artifact: SunburstArtifactInput,
  filesByArtifact: Map<string, SunburstFileInput[]>,
): IntelligenceSunburstNode {
  return asLeaf({
    id: `artifact:${artifact.id}`,
    name: artifact.title.trim() || artifact.id,
    kind: 'artifact',
    artifactId: artifact.id,
    children: filesForArtifact(artifact.id, filesByArtifact),
  });
}

function signalMatchesArtifact(
  signalSlug: string,
  artifact: SunburstArtifactInput,
): boolean {
  const wanted = extractLinkedSignalSlug(signalSlug);
  if (!wanted) return false;
  return (artifact.linked_signals ?? []).some(
    (raw) => extractLinkedSignalSlug(raw) === wanted,
  );
}

function boardMeta(
  slug: string,
  boards: readonly SunburstBoardInput[],
): { name: string; color: string } {
  const listed = boards.find((board) => board.slug === slug);
  return {
    name: listed?.name.trim() || slug,
    color: sunburstBoardColor(slug, boards),
  };
}

/**
 * Hierarchy for the zoomable sunburst:
 * root → board category → signal → artifact → file.
 * The chart draws this inverted (detail near the center, categories on the outer edge).
 */
export function buildIntelligenceSunburstTree(input: {
  signals: SunburstSignalInput[];
  artifacts: SunburstArtifactInput[];
  files?: SunburstFileInput[];
  boards?: SunburstBoardInput[];
  defaultBoard?: string;
  rootName?: string;
}): IntelligenceSunburstNode {
  const boards = [...(input.boards ?? [])]
    .filter((board) => !board.archived)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const defaultBoard =
    input.defaultBoard?.trim() ||
    boards.find((board) => board.slug === 'general')?.slug ||
    boards[0]?.slug ||
    SIGNAL_SUNBURST_UNCATEGORIZED_ID;

  const filesByArtifact = new Map<string, SunburstFileInput[]>();
  for (const file of input.files ?? []) {
    const artifactId = file.linked_artifact_id.trim();
    if (!artifactId) continue;
    const list = filesByArtifact.get(artifactId) ?? [];
    list.push(file);
    filesByArtifact.set(artifactId, list);
  }

  const linkedArtifactIds = new Set<string>();
  const signalsByBoard = new Map<string, SunburstSignalInput[]>();

  for (const signal of input.signals) {
    const slug = extractLinkedSignalSlug(signal.slug);
    if (!slug) continue;
    const boardSlug = resolveSunburstBoard(signal.board, boards, defaultBoard);
    const list = signalsByBoard.get(boardSlug) ?? [];
    list.push({ ...signal, slug, board: boardSlug });
    signalsByBoard.set(boardSlug, list);
    for (const artifact of input.artifacts) {
      if (signalMatchesArtifact(slug, artifact)) {
        linkedArtifactIds.add(artifact.id);
      }
    }
  }

  const boardOrder: string[] = [];
  const seen = new Set<string>();
  for (const board of boards) {
    seen.add(board.slug);
    boardOrder.push(board.slug);
  }
  for (const slug of signalsByBoard.keys()) {
    if (seen.has(slug)) continue;
    seen.add(slug);
    boardOrder.push(slug);
  }
  if (!seen.has(defaultBoard)) {
    boardOrder.push(defaultBoard);
  }

  const categoryNodes: IntelligenceSunburstNode[] = [];
  for (const boardSlug of boardOrder) {
    const signals = signalsByBoard.get(boardSlug) ?? [];
    const children: IntelligenceSunburstNode[] = signals.map((signal) => {
      const linked = input.artifacts.filter((artifact) =>
        signalMatchesArtifact(signal.slug, artifact),
      );
      return asLeaf({
        id: `signal:${signal.slug}`,
        name: signal.title.trim() || signal.slug,
        kind: 'signal',
        slug: signal.slug,
        categoryId: boardSlug,
        children: linked.map((artifact) =>
          artifactNode(artifact, filesByArtifact),
        ),
      });
    });

    if (boardSlug === defaultBoard) {
      for (const artifact of input.artifacts) {
        if (linkedArtifactIds.has(artifact.id)) continue;
        children.push(artifactNode(artifact, filesByArtifact));
      }
    }

    if (children.length === 0) continue;
    const meta = boardMeta(boardSlug, boards);
    categoryNodes.push({
      id: `category:${boardSlug}`,
      name: meta.name,
      kind: 'category',
      categoryId: boardSlug,
      color: meta.color,
      children,
    });
  }

  return {
    id: 'root',
    name: input.rootName?.trim() || 'Intelligence',
    kind: 'root',
    children: categoryNodes,
  };
}
