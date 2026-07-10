import { schemaSignalWorkflowConfig } from './validation';

export type SignalStatusCategory = 'backlog' | 'active' | 'done' | 'cancelled';

export type SignalStatusDefinition = {
  slug: string;
  name: string;
  color: string;
  category: SignalStatusCategory;
  position: number;
  isTerminal?: boolean;
};

export type SignalBoardDefinition = {
  slug: string;
  name: string;
  color: string;
  position: number;
  archived?: boolean;
};

export type SignalWorkflowConfig = {
  statuses: SignalStatusDefinition[];
  boards: SignalBoardDefinition[];
};

export const DEFAULT_SIGNAL_WORKFLOW: SignalWorkflowConfig = {
  statuses: [
    {
      slug: 'backlog',
      name: 'Backlog',
      color: 'neutral',
      category: 'backlog',
      position: 0,
    },
    {
      slug: 'todo',
      name: 'To do',
      color: 'accent',
      category: 'backlog',
      position: 1,
    },
    {
      slug: 'in_progress',
      name: 'In progress',
      color: 'warn',
      category: 'active',
      position: 2,
    },
    {
      slug: 'blocked',
      name: 'Blocked',
      color: 'error',
      category: 'active',
      position: 3,
    },
    {
      slug: 'done',
      name: 'Done',
      color: 'success',
      category: 'done',
      position: 4,
      isTerminal: true,
    },
  ],
  boards: [
    {
      slug: 'general',
      name: 'General',
      color: 'neutral',
      position: 0,
    },
  ],
};

export const DEFAULT_SIGNAL_PROGRESS_STATUS = 'backlog';

/** First backlog-column status for this space, or the first status overall. */
export function resolveDefaultProgressStatus(
  config: SignalWorkflowConfig,
): string {
  const ordered = [...config.statuses].sort((a, b) => a.position - b.position);
  const backlogStatus = ordered.find((status) => status.category === 'backlog');
  if (backlogStatus) return backlogStatus.slug;
  if (
    ordered.some((status) => status.slug === DEFAULT_SIGNAL_PROGRESS_STATUS)
  ) {
    return DEFAULT_SIGNAL_PROGRESS_STATUS;
  }
  return ordered[0]?.slug ?? DEFAULT_SIGNAL_PROGRESS_STATUS;
}

/** First active board for this space — prefers `general`, else lowest position. */
export function resolveDefaultBoard(config: SignalWorkflowConfig): string {
  const activeBoards = config.boards.filter((board) => !board.archived);
  const general = activeBoards.find((board) => board.slug === 'general');
  if (general) return general.slug;
  const sorted = [...activeBoards].sort((a, b) => a.position - b.position);
  return sorted[0]?.slug ?? 'general';
}

/** Map null/unknown board slugs to the space default board (`general` when present). */
export function resolveEffectiveBoard(
  board: string | null | undefined,
  config: SignalWorkflowConfig,
): string {
  const trimmed = board?.trim();
  if (trimmed) {
    const exists = config.boards.some(
      (item) => item.slug === trimmed && !item.archived,
    );
    if (exists) return trimmed;
  }
  return resolveDefaultBoard(config);
}

function normalizeSlugBase(base: string): string {
  const lower = base.trim().toLowerCase();
  let normalized = '';
  let lastWasUnderscore = false;
  for (const char of lower) {
    const code = char.charCodeAt(0);
    const isSlugChar =
      (code >= 97 && code <= 122) || (code >= 48 && code <= 57) || char === '_';
    if (isSlugChar) {
      normalized += char;
      lastWasUnderscore = char === '_';
      continue;
    }
    if (!lastWasUnderscore && normalized.length > 0) {
      normalized += '_';
      lastWasUnderscore = true;
    }
  }
  let start = 0;
  while (start < normalized.length && normalized[start] === '_') {
    start += 1;
  }
  let end = normalized.length;
  while (end > start && normalized[end - 1] === '_') {
    end -= 1;
  }
  return normalized.slice(start, end).slice(0, 64) || 'item';
}

function reserveUniqueSlug(base: string, used: Set<string>): string {
  const normalized = normalizeSlugBase(base);
  if (!used.has(normalized)) {
    used.add(normalized);
    return normalized;
  }
  let counter = 2;
  while (used.has(`${normalized}_${counter}`)) {
    counter += 1;
  }
  const next = `${normalized}_${counter}`.slice(0, 64);
  used.add(next);
  return next;
}

function reindexWorkflowPositions<T extends { position: number }>(
  items: T[],
): T[] {
  return items.map((item, index) => ({ ...item, position: index }));
}

/** Normalize editor draft before save — fixes duplicate slugs and empty names. */
export function sanitizeSignalWorkflowConfig(
  config: SignalWorkflowConfig,
): SignalWorkflowConfig {
  const statusSlugs = new Set<string>();
  const statuses = reindexWorkflowPositions(
    [...config.statuses]
      .sort((a, b) => a.position - b.position)
      .map((status, index) => {
        const slug = reserveUniqueSlug(
          status.slug || `status_${index + 1}`,
          statusSlugs,
        );
        const name = status.name.trim() || `Status ${index + 1}`;
        return { ...status, slug, name };
      }),
  );

  const boardSlugs = new Set<string>();
  const boards = reindexWorkflowPositions(
    [...config.boards]
      .sort((a, b) => a.position - b.position)
      .map((board, index) => {
        const slug = reserveUniqueSlug(
          board.slug || `board_${index + 1}`,
          boardSlugs,
        );
        const name = board.name.trim() || `Category ${index + 1}`;
        return { ...board, slug, name };
      }),
  );

  const parsed = schemaSignalWorkflowConfig.parse({ statuses, boards });
  return {
    statuses: [...parsed.statuses].sort((a, b) => a.position - b.position),
    boards: [...parsed.boards].sort((a, b) => a.position - b.position),
  };
}

export function normalizeSignalWorkflowConfig(
  raw: unknown,
): SignalWorkflowConfig {
  const parsed = schemaSignalWorkflowConfig.safeParse(raw);
  if (parsed.success) {
    return {
      statuses: [...parsed.data.statuses].sort(
        (a, b) => a.position - b.position,
      ),
      boards: [...parsed.data.boards].sort((a, b) => a.position - b.position),
    };
  }
  return structuredClone(DEFAULT_SIGNAL_WORKFLOW);
}

export function normalizeAssigneeIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of raw) {
    const id =
      typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isFinite(id) || id < 1 || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function hydrateCoherenceFromApi<
  T extends {
    createdAt: Date | string;
    updatedAt: Date | string;
    dueAt?: Date | string | null;
    assigneeIds?: unknown;
  },
>(
  raw: T,
): T & {
  createdAt: Date;
  updatedAt: Date;
  dueAt: Date | null;
  assigneeIds: number[];
} {
  return {
    ...raw,
    createdAt: new Date(raw.createdAt),
    updatedAt: new Date(raw.updatedAt),
    dueAt: raw.dueAt ? new Date(raw.dueAt) : null,
    assigneeIds: normalizeAssigneeIds(raw.assigneeIds),
  };
}
