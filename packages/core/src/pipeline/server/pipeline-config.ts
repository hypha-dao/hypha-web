import { eq } from 'drizzle-orm';
import { spaces } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import {
  mergePipelineConfig,
  normalizePipelineConfig,
  type PipelineConfig,
  type PipelineConfigPatch,
} from '../pipeline-config';

export async function readPipelineConfig(
  { spaceId }: { spaceId: number },
  { db }: DbConfig,
): Promise<PipelineConfig> {
  const [space] = await db
    .select({ pipelineConfig: spaces.pipelineConfig })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);

  if (!space) {
    throw new Error(`Space not found for id=${spaceId}`);
  }

  return normalizePipelineConfig(space.pipelineConfig);
}

export async function updatePipelineConfig(
  {
    spaceId,
    config,
  }: {
    spaceId: number;
    config: PipelineConfigPatch;
  },
  { db }: DbConfig,
): Promise<PipelineConfig> {
  const [space] = await db
    .select({ pipelineConfig: spaces.pipelineConfig })
    .from(spaces)
    .where(eq(spaces.id, spaceId))
    .limit(1);

  if (!space) {
    throw new Error(`Space not found for id=${spaceId}`);
  }

  // Partial update: sections missing from the patch keep their stored value.
  const normalized = mergePipelineConfig(space.pipelineConfig, config);

  const [updated] = await db
    .update(spaces)
    .set({
      pipelineConfig: normalized,
      updatedAt: new Date(),
    })
    .where(eq(spaces.id, spaceId))
    .returning();

  if (!updated) {
    throw new Error(`Space not found for id=${spaceId}`);
  }

  return normalizePipelineConfig(updated.pipelineConfig);
}
