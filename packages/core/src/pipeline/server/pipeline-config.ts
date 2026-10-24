import { and, eq, inArray } from 'drizzle-orm';
import { deals, spaces } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import { resolveDefaultStageSlug, resolveDefaultTrackSlug } from '../constants';
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

  const previous = normalizePipelineConfig(space.pipelineConfig);
  // Partial update: sections missing from the patch keep their stored value.
  const normalized = mergePipelineConfig(space.pipelineConfig, config);

  const nextStageSlugs = new Set(normalized.stages.map((stage) => stage.slug));
  const removedStageSlugs = previous.stages
    .map((stage) => stage.slug)
    .filter((slug) => !nextStageSlugs.has(slug));
  if (removedStageSlugs.length > 0) {
    const fallbackStatus = resolveDefaultStageSlug(normalized.stages);
    await db
      .update(deals)
      .set({
        pipelineStatus: fallbackStatus,
        successRate: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deals.spaceId, spaceId),
          inArray(deals.pipelineStatus, removedStageSlugs),
        ),
      );
  }

  const nextTrackSlugs = new Set(normalized.tracks.map((track) => track.slug));
  const removedTrackSlugs = previous.tracks
    .map((track) => track.slug)
    .filter((slug) => !nextTrackSlugs.has(slug));
  if (removedTrackSlugs.length > 0) {
    const fallbackTrack = resolveDefaultTrackSlug(normalized.tracks);
    await db
      .update(deals)
      .set({
        pipelineSwimlane: fallbackTrack,
        successRate: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(deals.spaceId, spaceId),
          inArray(deals.pipelineSwimlane, removedTrackSlugs),
        ),
      );
  }

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

export function assertDealFitsPipelineConfig(
  input: {
    pipelineSwimlane?: string;
    pipelineStatus?: string;
  },
  config: PipelineConfig,
): void {
  if (
    input.pipelineSwimlane &&
    !config.tracks.some((track) => track.slug === input.pipelineSwimlane)
  ) {
    throw new Error(`Unknown track "${input.pipelineSwimlane}" for this space`);
  }
  if (
    input.pipelineStatus &&
    !config.stages.some((stage) => stage.slug === input.pipelineStatus)
  ) {
    throw new Error(`Unknown stage "${input.pipelineStatus}" for this space`);
  }
}
