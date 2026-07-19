import 'server-only';

import { and, eq, gte, sql } from 'drizzle-orm';
import { coherences, spaces } from '@hypha-platform/storage-postgres';
import { getSignalOrchestratorMetrics } from '../../coherence/server/signal-orchestrator';
import type { DbConfig } from '../../server';

export async function getPlatformSignalsStats({ db }: DbConfig) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalsByType,
    totalsByPriority,
    perSpaceTotals,
    totalSignalsRow,
    createdLast24h,
    createdLast7d,
    orchestratorMetrics,
  ] = await Promise.all([
    db
      .select({
        type: coherences.type,
        count: sql<number>`count(*)`,
      })
      .from(coherences)
      .where(eq(coherences.archived, false))
      .groupBy(coherences.type),
    db
      .select({
        priority: coherences.priority,
        count: sql<number>`count(*)`,
      })
      .from(coherences)
      .where(eq(coherences.archived, false))
      .groupBy(coherences.priority),
    db
      .select({
        spaceId: coherences.spaceId,
        spaceSlug: spaces.slug,
        spaceTitle: spaces.title,
        count: sql<number>`count(*)`,
      })
      .from(coherences)
      .innerJoin(spaces, eq(coherences.spaceId, spaces.id))
      .where(eq(coherences.archived, false))
      .groupBy(coherences.spaceId, spaces.slug, spaces.title)
      .orderBy(sql`count(*) desc`),
    db
      .select({ count: sql<number>`count(*)` })
      .from(coherences)
      .where(eq(coherences.archived, false)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(coherences)
      .where(
        and(
          eq(coherences.archived, false),
          gte(coherences.createdAt, since24h),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(coherences)
      .where(
        and(eq(coherences.archived, false), gte(coherences.createdAt, since7d)),
      ),
    getSignalOrchestratorMetrics({ db }),
  ]);

  const totalSignals = Number(totalSignalsRow[0]?.count ?? 0);

  return {
    summary: {
      totalSignals,
      createdLast24h: Number(createdLast24h[0]?.count ?? 0),
      createdLast7d: Number(createdLast7d[0]?.count ?? 0),
      spacesWithSignals: perSpaceTotals.length,
    },
    byType: totalsByType.map((row) => ({
      type: row.type,
      count: Number(row.count ?? 0),
    })),
    byPriority: totalsByPriority.map((row) => ({
      priority: row.priority ?? 'unknown',
      count: Number(row.count ?? 0),
    })),
    bySpace: perSpaceTotals.map((row) => ({
      spaceId: row.spaceId,
      slug: row.spaceSlug,
      title: row.spaceTitle,
      count: Number(row.count ?? 0),
    })),
    orchestrator: orchestratorMetrics,
  };
}
