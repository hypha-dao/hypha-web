import 'server-only';

import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import {
  spaceCallRecordings,
  spaceCallTranscripts,
  spaceDiscussionSummaries,
  spaces,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../server';

export async function getPlatformSpaceMemoryStats({ db }: DbConfig) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    spacesWithChatRow,
    summaryTotalRow,
    transcriptTotalRow,
    recordingTotalRow,
    summaries24h,
    summaries7d,
    perSpaceSummaries,
    perSpaceTranscripts,
    perSpaceRecordings,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaces)
      .where(and(isNotNull(spaces.chatRoomId), eq(spaces.isArchived, false))),
    db.select({ count: sql<number>`count(*)` }).from(spaceDiscussionSummaries),
    db.select({ count: sql<number>`count(*)` }).from(spaceCallTranscripts),
    db.select({ count: sql<number>`count(*)` }).from(spaceCallRecordings),
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaceDiscussionSummaries)
      .where(gte(spaceDiscussionSummaries.createdAt, since24h)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaceDiscussionSummaries)
      .where(gte(spaceDiscussionSummaries.createdAt, since7d)),
    db
      .select({
        spaceId: spaceDiscussionSummaries.spaceId,
        spaceSlug: spaces.slug,
        spaceTitle: spaces.title,
        count: sql<number>`count(*)`,
      })
      .from(spaceDiscussionSummaries)
      .innerJoin(spaces, eq(spaceDiscussionSummaries.spaceId, spaces.id))
      .groupBy(spaceDiscussionSummaries.spaceId, spaces.slug, spaces.title)
      .orderBy(sql`count(*) desc`),
    db
      .select({
        spaceId: spaceCallTranscripts.spaceId,
        spaceSlug: spaces.slug,
        spaceTitle: spaces.title,
        count: sql<number>`count(*)`,
      })
      .from(spaceCallTranscripts)
      .innerJoin(spaces, eq(spaceCallTranscripts.spaceId, spaces.id))
      .groupBy(spaceCallTranscripts.spaceId, spaces.slug, spaces.title)
      .orderBy(sql`count(*) desc`),
    db
      .select({
        spaceId: spaceCallRecordings.spaceId,
        spaceSlug: spaces.slug,
        spaceTitle: spaces.title,
        count: sql<number>`count(*)`,
      })
      .from(spaceCallRecordings)
      .innerJoin(spaces, eq(spaceCallRecordings.spaceId, spaces.id))
      .groupBy(spaceCallRecordings.spaceId, spaces.slug, spaces.title)
      .orderBy(sql`count(*) desc`),
  ]);

  return {
    summary: {
      spacesWithChat: Number(spacesWithChatRow[0]?.count ?? 0),
      summariesTotal: Number(summaryTotalRow[0]?.count ?? 0),
      transcriptsTotal: Number(transcriptTotalRow[0]?.count ?? 0),
      recordingsTotal: Number(recordingTotalRow[0]?.count ?? 0),
      summariesLast24h: Number(summaries24h[0]?.count ?? 0),
      summariesLast7d: Number(summaries7d[0]?.count ?? 0),
    },
    bySpace: {
      summaries: perSpaceSummaries.map((row) => ({
        spaceId: row.spaceId,
        slug: row.spaceSlug,
        title: row.spaceTitle,
        count: Number(row.count ?? 0),
      })),
      transcripts: perSpaceTranscripts.map((row) => ({
        spaceId: row.spaceId,
        slug: row.spaceSlug,
        title: row.spaceTitle,
        count: Number(row.count ?? 0),
      })),
      recordings: perSpaceRecordings.map((row) => ({
        spaceId: row.spaceId,
        slug: row.spaceSlug,
        title: row.spaceTitle,
        count: Number(row.count ?? 0),
      })),
    },
  };
}
