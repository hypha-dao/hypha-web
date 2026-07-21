import 'server-only';

import { and, eq, gte, sql } from 'drizzle-orm';
import {
  coherences,
  signalOrchestratorDispatches,
  signalOrchestratorQueue,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../server';

const SIGNALS_CACHE_TTL_MS = 15 * 60 * 1000;

type SpaceOverviewSignals = Awaited<
  ReturnType<typeof computeSpaceOverviewSignals>
>;

const signalsCache = new Map<
  number,
  { expiresAt: number; data: SpaceOverviewSignals }
>();
const signalsInFlight = new Map<number, Promise<SpaceOverviewSignals>>();

async function computeSpaceOverviewSignals({ db }: DbConfig, spaceId: number) {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const spaceFilter = and(
    eq(coherences.archived, false),
    eq(coherences.spaceId, spaceId),
  );

  const [
    totalsByType,
    totalsByPriority,
    totalsByStatus,
    weeklyCreated,
    summaryCountsRow,
    pending,
    failed,
    emitted,
    relays,
  ] = await Promise.all([
    db
      .select({
        type: coherences.type,
        count: sql<number>`count(*)`,
      })
      .from(coherences)
      .where(spaceFilter)
      .groupBy(coherences.type),
    db
      .select({
        priority: coherences.priority,
        count: sql<number>`count(*)`,
      })
      .from(coherences)
      .where(spaceFilter)
      .groupBy(coherences.priority),
    db
      .select({
        status: coherences.progressStatus,
        count: sql<number>`count(*)`,
      })
      .from(coherences)
      .where(spaceFilter)
      .groupBy(coherences.progressStatus),
    db
      .select({
        week: sql<string>`to_char(date_trunc('week', ${coherences.createdAt}), 'IYYY-"W"IW')`,
        count: sql<number>`count(*)`,
      })
      .from(coherences)
      .where(
        and(
          spaceFilter,
          gte(
            coherences.createdAt,
            new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000),
          ),
        ),
      )
      .groupBy(sql`date_trunc('week', ${coherences.createdAt})`)
      .orderBy(sql`date_trunc('week', ${coherences.createdAt})`),
    db
      .select({
        total: sql<number>`count(*)`,
        last24h: sql<number>`count(*) filter (where ${coherences.createdAt} >= ${since24h})`,
        last7d: sql<number>`count(*) filter (where ${coherences.createdAt} >= ${since7d})`,
      })
      .from(coherences)
      .where(spaceFilter),
    db
      .select({ count: sql<number>`count(*)` })
      .from(signalOrchestratorQueue)
      .where(
        and(
          eq(signalOrchestratorQueue.spaceId, spaceId),
          eq(signalOrchestratorQueue.state, 'pending'),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(signalOrchestratorQueue)
      .where(
        and(
          eq(signalOrchestratorQueue.spaceId, spaceId),
          eq(signalOrchestratorQueue.state, 'failed'),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(signalOrchestratorDispatches)
      .where(
        and(
          eq(signalOrchestratorDispatches.sourceSpaceId, spaceId),
          eq(signalOrchestratorDispatches.mode, 'space'),
          eq(signalOrchestratorDispatches.decision, 'emitted'),
          gte(signalOrchestratorDispatches.createdAt, since24h),
        ),
      ),
    db
      .select({ count: sql<number>`count(*)` })
      .from(signalOrchestratorDispatches)
      .where(
        and(
          eq(signalOrchestratorDispatches.sourceSpaceId, spaceId),
          eq(signalOrchestratorDispatches.mode, 'relay'),
          eq(signalOrchestratorDispatches.decision, 'emitted'),
          gte(signalOrchestratorDispatches.createdAt, since24h),
        ),
      ),
  ]);

  return {
    summary: {
      totalSignals: Number(summaryCountsRow[0]?.total ?? 0),
      createdLast24h: Number(summaryCountsRow[0]?.last24h ?? 0),
      createdLast7d: Number(summaryCountsRow[0]?.last7d ?? 0),
    },
    byType: totalsByType.map((row) => ({
      type: row.type,
      count: Number(row.count ?? 0),
    })),
    byPriority: totalsByPriority.map((row) => ({
      priority: row.priority ?? 'unknown',
      count: Number(row.count ?? 0),
    })),
    byStatus: totalsByStatus
      .map((row) => ({
        status: row.status?.trim() || 'backlog',
        count: Number(row.count ?? 0),
      }))
      .sort((a, b) => b.count - a.count),
    weekly: weeklyCreated.map((row) => ({
      week: row.week,
      count: Number(row.count ?? 0),
    })),
    orchestrator: {
      queue_pending: Number(pending[0]?.count ?? 0),
      queue_failed: Number(failed[0]?.count ?? 0),
      signals_emitted_last_24h: Number(emitted[0]?.count ?? 0),
      relays_emitted_last_24h: Number(relays[0]?.count ?? 0),
    },
  };
}

export async function getSpaceOverviewSignals(
  config: DbConfig,
  spaceId: number,
) {
  const cached = signalsCache.get(spaceId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const inFlight = signalsInFlight.get(spaceId);
  if (inFlight) {
    return inFlight;
  }

  const promise = computeSpaceOverviewSignals(config, spaceId)
    .then((data) => {
      signalsCache.set(spaceId, {
        data,
        expiresAt: Date.now() + SIGNALS_CACHE_TTL_MS,
      });
      return data;
    })
    .finally(() => {
      signalsInFlight.delete(spaceId);
    });

  signalsInFlight.set(spaceId, promise);
  return promise;
}
