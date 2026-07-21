import { and, desc, eq, sql } from 'drizzle-orm';
import {
  coherences,
  spaceHighlightProfiles,
  spaces,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import type {
  HighlightsBlock,
  HighlightsProfile,
  HighlightsStory,
  HighlightsSupportAction,
  MarketplaceListingItem,
} from '../types';

function asBlocks(value: unknown): HighlightsBlock[] {
  return Array.isArray(value) ? (value as HighlightsBlock[]) : [];
}

function asSupportActions(value: unknown): HighlightsSupportAction[] {
  return Array.isArray(value) ? (value as HighlightsSupportAction[]) : [];
}

export function mapHighlightProfileRow(
  row: typeof spaceHighlightProfiles.$inferSelect,
): HighlightsProfile {
  return {
    published: row.published,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    summary: row.summary ?? null,
    coverImageUrl: row.coverImageUrl ?? null,
    goalAmount: row.goalAmount != null ? String(row.goalAmount) : null,
    goalCurrency: row.goalCurrency ?? null,
    blocks: asBlocks(row.blocks),
    supportActions: asSupportActions(row.supportActions),
  };
}

export function sanitizeSupportActionsForPublic(
  actions: HighlightsSupportAction[],
): HighlightsSupportAction[] {
  return actions.map((action) => ({
    ...action,
    walletAddress: undefined,
    copyInstructions: undefined,
    bankingRail: action.destination === 'iban' ? action.bankingRail : undefined,
  }));
}

export const findHighlightProfileBySpaceId = async (
  spaceId: number,
  { db }: DbConfig,
) => {
  const [row] = await db
    .select()
    .from(spaceHighlightProfiles)
    .where(eq(spaceHighlightProfiles.spaceId, spaceId))
    .limit(1);
  return row ?? null;
};

export const findStoryCoherencesBySpaceId = async (
  spaceId: number,
  { db }: DbConfig,
): Promise<HighlightsStory[]> => {
  const rows = await db
    .select()
    .from(coherences)
    .where(
      and(
        eq(coherences.spaceId, spaceId),
        eq(coherences.type, 'Story'),
        eq(coherences.archived, false),
      ),
    )
    .orderBy(desc(coherences.createdAt));

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug ?? String(row.id),
    title: row.title,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    // Coherence rows have no metadata column yet; use createdAt as story date.
    eventDate: row.createdAt.toISOString(),
    attachments: [] as Array<{ url: string; caption?: string }>,
  }));
};

export const listPublishedHighlightProfiles = async (
  {
    page,
    pageSize,
    offset,
  }: { page: number; pageSize: number; offset: number },
  { db }: DbConfig,
): Promise<{ items: MarketplaceListingItem[]; total: number }> => {
  const where = eq(spaceHighlightProfiles.published, true);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(spaceHighlightProfiles)
    .where(where);

  const rows = await db
    .select({
      profile: spaceHighlightProfiles,
      space: spaces,
    })
    .from(spaceHighlightProfiles)
    .innerJoin(spaces, eq(spaceHighlightProfiles.spaceId, spaces.id))
    .where(where)
    .orderBy(
      desc(spaceHighlightProfiles.publishedAt),
      desc(spaceHighlightProfiles.updatedAt),
    )
    .limit(pageSize)
    .offset(offset);

  const items: MarketplaceListingItem[] = rows.map(({ profile, space }) => ({
    spaceSlug: space.slug,
    spaceTitle: space.title,
    logoUrl: space.logoUrl ?? null,
    leadImage: space.leadImage ?? null,
    locationLabel: space.locationLabel ?? null,
    summary: profile.summary ?? null,
    coverImageUrl: profile.coverImageUrl ?? space.leadImage ?? null,
    goalAmount: profile.goalAmount != null ? String(profile.goalAmount) : null,
    goalCurrency: profile.goalCurrency ?? null,
    publishedAt: profile.publishedAt?.toISOString() ?? null,
  }));

  return { items, total: countRow?.count ?? 0 };
};
