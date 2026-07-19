import 'server-only';

import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import {
  spaceCallRecordings,
  spaceCallTranscripts,
  spaceDiscussionSummaries,
  spaces,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../server';

export async function getSpaceOverviewMemory(
  { db }: DbConfig,
  spaceId: number,
) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    hasChatRow,
    summaryTotalRow,
    transcriptTotalRow,
    recordingTotalRow,
    summaries24h,
    summaries7d,
  ] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaces)
      .where(
        and(
          eq(spaces.id, spaceId),
          isNotNull(spaces.chatRoomId),
          eq(spaces.isArchived, false),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaceDiscussionSummaries)
      .where(eq(spaceDiscussionSummaries.spaceId, spaceId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaceCallTranscripts)
      .where(eq(spaceCallTranscripts.spaceId, spaceId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaceCallRecordings)
      .where(eq(spaceCallRecordings.spaceId, spaceId)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaceDiscussionSummaries)
      .where(
        and(
          eq(spaceDiscussionSummaries.spaceId, spaceId),
          gte(spaceDiscussionSummaries.createdAt, since24h),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(spaceDiscussionSummaries)
      .where(
        and(
          eq(spaceDiscussionSummaries.spaceId, spaceId),
          gte(spaceDiscussionSummaries.createdAt, since7d),
        ),
      ),
  ]);

  return {
    summary: {
      hasChat: Number(hasChatRow[0]?.count ?? 0) > 0,
      summariesTotal: Number(summaryTotalRow[0]?.count ?? 0),
      transcriptsTotal: Number(transcriptTotalRow[0]?.count ?? 0),
      recordingsTotal: Number(recordingTotalRow[0]?.count ?? 0),
      summariesLast24h: Number(summaries24h[0]?.count ?? 0),
      summariesLast7d: Number(summaries7d[0]?.count ?? 0),
    },
  };
}
