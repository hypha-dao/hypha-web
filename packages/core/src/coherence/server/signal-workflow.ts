import { and, eq, inArray } from 'drizzle-orm';
import { coherences, spaces } from '@hypha-platform/storage-postgres';
import { DbConfig } from '../../server';
import {
  DEFAULT_SIGNAL_PROGRESS_STATUS,
  DEFAULT_SIGNAL_WORKFLOW,
  normalizeSignalWorkflowConfig,
  resolveDefaultBoard,
  sanitizeSignalWorkflowConfig,
  type SignalWorkflowConfig,
} from '../signal-workflow';

export async function readSignalWorkflowConfig(
  { spaceId }: { spaceId: number },
  { db }: DbConfig,
): Promise<SignalWorkflowConfig> {
  const [space] = await db
    .select({ signalWorkflow: spaces.signalWorkflow })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);

  if (!space) {
    throw new Error(`Space not found for id=${spaceId}`);
  }

  return normalizeSignalWorkflowConfig(space.signalWorkflow);
}

export async function ensureSignalWorkflowConfig(
  { spaceId }: { spaceId: number },
  { db }: DbConfig,
): Promise<SignalWorkflowConfig> {
  const [space] = await db
    .select({ signalWorkflow: spaces.signalWorkflow })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);

  if (!space) {
    throw new Error(`Space not found for id=${spaceId}`);
  }

  const config = normalizeSignalWorkflowConfig(space.signalWorkflow);
  const hasPersistedConfig =
    space.signalWorkflow &&
    typeof space.signalWorkflow === 'object' &&
    Object.keys(space.signalWorkflow as object).length > 0;

  if (!hasPersistedConfig) {
    await db
      .update(spaces)
      .set({ signalWorkflow: config })
      .where(eq(spaces.id, spaceId));
  }

  return config;
}

/** @deprecated Use readSignalWorkflowConfig or ensureSignalWorkflowConfig */
export async function getSignalWorkflowConfig(
  input: { spaceId: number },
  config: DbConfig,
): Promise<SignalWorkflowConfig> {
  return ensureSignalWorkflowConfig(input, config);
}

export async function updateSignalWorkflowConfig(
  {
    spaceId,
    config,
  }: {
    spaceId: number;
    config: SignalWorkflowConfig;
  },
  { db }: DbConfig,
): Promise<SignalWorkflowConfig> {
  const previous = await readSignalWorkflowConfig({ spaceId }, { db });
  const normalized = sanitizeSignalWorkflowConfig(config);

  const nextStatusSlugs = new Set(
    normalized.statuses.map((status) => status.slug),
  );
  const removedStatusSlugs = previous.statuses
    .map((status) => status.slug)
    .filter((slug) => !nextStatusSlugs.has(slug));

  if (removedStatusSlugs.length > 0) {
    const fallbackStatus =
      normalized.statuses.find((status) => status.category === 'backlog')
        ?.slug ??
      normalized.statuses[0]?.slug ??
      DEFAULT_SIGNAL_PROGRESS_STATUS;
    await db
      .update(coherences)
      .set({ progressStatus: fallbackStatus })
      .where(
        and(
          eq(coherences.spaceId, spaceId),
          inArray(coherences.progressStatus, removedStatusSlugs),
        ),
      );
  }

  const nextBoardSlugs = new Set(normalized.boards.map((board) => board.slug));
  const removedBoardSlugs = previous.boards
    .map((board) => board.slug)
    .filter((slug) => !nextBoardSlugs.has(slug));

  if (removedBoardSlugs.length > 0) {
    const fallbackBoard = resolveDefaultBoard(normalized);
    await db
      .update(coherences)
      .set({ board: fallbackBoard })
      .where(
        and(
          eq(coherences.spaceId, spaceId),
          inArray(coherences.board, removedBoardSlugs),
        ),
      );
  }

  const [updated] = await db
    .update(spaces)
    .set({ signalWorkflow: normalized })
    .where(eq(spaces.id, spaceId))
    .returning();

  if (!updated) {
    throw new Error(`Failed to update signal workflow for spaceId=${spaceId}`);
  }

  return normalizeSignalWorkflowConfig(updated.signalWorkflow);
}

export function assertValidProgressStatus(
  config: SignalWorkflowConfig,
  slug: string | null | undefined,
): void {
  if (slug == null || slug === '') return;
  const exists = config.statuses.some((status) => status.slug === slug);
  if (!exists) {
    throw new Error(`Unknown progress status "${slug}" for this space`);
  }
}

export function assertValidBoard(
  config: SignalWorkflowConfig,
  slug: string | null | undefined,
): void {
  if (slug == null || slug === '') return;
  const exists = config.boards.some(
    (board) => board.slug === slug && !board.archived,
  );
  if (!exists) {
    throw new Error(`Unknown board "${slug}" for this space`);
  }
}

export function getDefaultSignalWorkflow(): SignalWorkflowConfig {
  return structuredClone(DEFAULT_SIGNAL_WORKFLOW);
}
