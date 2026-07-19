import 'server-only';

import { and, eq, gte, isNotNull, or, sql } from 'drizzle-orm';
import {
  documents,
  spaceCallRecordings,
  spaceCallTranscripts,
  spaceDiscussionSummaries,
  spaces,
} from '@hypha-platform/storage-postgres';
import { SPACE_MEMORY_DOCUMENT_LABEL } from '../../governance/space-memory-document-label';
import type { DbConfig } from '../../server';

function userCreatedMemoryFilter(spaceId: number) {
  return and(
    eq(documents.spaceId, spaceId),
    or(
      eq(documents.state, 'memory'),
      eq(documents.label, SPACE_MEMORY_DOCUMENT_LABEL),
    ),
  );
}

export async function getSpaceOverviewMemory(
  { db }: DbConfig,
  spaceId: number,
) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    hasChatRow,
    summaryCountsRow,
    transcriptTotalRow,
    recordingTotalRow,
    userCreatedTotalRow,
    weeklySummaries,
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
      .select({
        total: sql<number>`count(*)`,
        last24h: sql<number>`count(*) filter (where ${spaceDiscussionSummaries.createdAt} >= ${since24h})`,
        last7d: sql<number>`count(*) filter (where ${spaceDiscussionSummaries.createdAt} >= ${since7d})`,
      })
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
      .from(documents)
      .where(userCreatedMemoryFilter(spaceId)),
    db
      .select({
        week: sql<string>`to_char(date_trunc('week', ${spaceDiscussionSummaries.createdAt}), 'IYYY-"W"IW')`,
        count: sql<number>`count(*)`,
      })
      .from(spaceDiscussionSummaries)
      .where(
        and(
          eq(spaceDiscussionSummaries.spaceId, spaceId),
          gte(
            spaceDiscussionSummaries.createdAt,
            new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .groupBy(sql`date_trunc('week', ${spaceDiscussionSummaries.createdAt})`)
      .orderBy(sql`date_trunc('week', ${spaceDiscussionSummaries.createdAt})`),
  ]);

  return {
    summary: {
      hasChat: Number(hasChatRow[0]?.count ?? 0) > 0,
      summariesTotal: Number(summaryCountsRow[0]?.total ?? 0),
      transcriptsTotal: Number(transcriptTotalRow[0]?.count ?? 0),
      recordingsTotal: Number(recordingTotalRow[0]?.count ?? 0),
      userCreatedTotal: Number(userCreatedTotalRow[0]?.count ?? 0),
      summariesLast24h: Number(summaryCountsRow[0]?.last24h ?? 0),
      summariesLast7d: Number(summaryCountsRow[0]?.last7d ?? 0),
    },
    weekly: weeklySummaries.map((row) => ({
      week: row.week,
      count: Number(row.count ?? 0),
    })),
  };
}
