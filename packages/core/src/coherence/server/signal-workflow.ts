import { eq } from 'drizzle-orm';
import { spaces } from '@hypha-platform/storage-postgres';
import { DbConfig } from '../../server';
import {
  DEFAULT_SIGNAL_WORKFLOW,
  normalizeSignalWorkflowConfig,
  type SignalWorkflowConfig,
} from '../signal-workflow';

export async function getSignalWorkflowConfig(
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
  const normalized = normalizeSignalWorkflowConfig(config);
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
