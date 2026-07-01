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
