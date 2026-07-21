import { eq } from 'drizzle-orm';
import { spaceHighlightProfiles } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import type { UpsertHighlightProfileInput } from '../validation';
import { validateHighlightProfileForPublish } from '../publish-validation';
import { findHighlightProfileBySpaceId } from './queries';
import type { HighlightsBlock, HighlightsSupportAction } from '../types';

export const upsertHighlightProfile = async (
  {
    spaceId,
    ...input
  }: UpsertHighlightProfileInput & {
    spaceId: number;
  },
  { db }: DbConfig,
) => {
  const [row] = await db
    .insert(spaceHighlightProfiles)
    .values({
      spaceId,
      summary: input.summary ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      goalAmount: input.goalAmount ?? null,
      goalCurrency: input.goalCurrency ?? null,
      blocks: input.blocks,
      supportActions: input.supportActions,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: spaceHighlightProfiles.spaceId,
      set: {
        summary: input.summary ?? null,
        coverImageUrl: input.coverImageUrl ?? null,
        goalAmount: input.goalAmount ?? null,
        goalCurrency: input.goalCurrency ?? null,
        blocks: input.blocks,
        supportActions: input.supportActions,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
};

export const setHighlightProfilePublished = async (
  {
    spaceId,
    published,
    discoverability,
  }: {
    spaceId: number;
    published: boolean;
    discoverability?: number | null;
  },
  { db }: DbConfig,
) => {
  const existing = await findHighlightProfileBySpaceId(spaceId, { db });
  if (!existing) {
    return {
      ok: false as const,
      errors: ['Highlights profile not found. Save content before publishing.'],
    };
  }

  if (published) {
    const validation = validateHighlightProfileForPublish({
      blocks: existing.blocks as HighlightsBlock[],
      supportActions: existing.supportActions as HighlightsSupportAction[],
      discoverability,
    });
    if (!validation.ok) {
      return validation;
    }
  }

  const [row] = await db
    .update(spaceHighlightProfiles)
    .set({
      published,
      publishedAt: published ? existing.publishedAt ?? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(spaceHighlightProfiles.spaceId, spaceId))
    .returning();

  return { ok: true as const, profile: row };
};
