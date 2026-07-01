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

function reserveUniqueSlug(base: string, used: Set<string>): string {
  const normalized =
    base
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64) || 'item';
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
        const slug = reserveUniqueSlug(status.slug || `status_${index + 1}`, statusSlugs);
        const name = status.name.trim() || `Status ${index + 1}`;
        return { ...status, slug, name };
      }),
  );

  const boardSlugs = new Set<string>();
  const boards = reindexWorkflowPositions(
    [...config.boards]
      .sort((a, b) => a.position - b.position)
      .map((board, index) => {
        const slug = reserveUniqueSlug(board.slug || `board_${index + 1}`, boardSlugs);
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
