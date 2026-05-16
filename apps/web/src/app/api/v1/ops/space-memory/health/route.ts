import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { getSignalOrchestratorMetrics } from '@hypha-platform/core/server';
import {
  db,
  spaceCallRecordings,
  spaceCallTranscripts,
  spaceDiscussionSummaries,
  spaces,
} from '@hypha-platform/storage-postgres';
import { readOpsSecret } from '../../_lib/ops-auth';

export async function GET(request: NextRequest) {
  const configuredSecret =
    process.env.HYPHA_SPACE_MEMORY_OPS_SECRET?.trim() ?? '';
  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'HYPHA_SPACE_MEMORY_OPS_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (readOpsSecret(request) !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);

  let queried:
    | [
        Array<{ count: number }>,
        Array<{ count: number }>,
        Array<{ count: number }>,
        Array<{ count: number }>,
        Array<{ count: number }>,
        Array<{ count: number }>,
        Array<{ count: number }>,
        Array<{ count: number }>,
        Awaited<ReturnType<typeof getSignalOrchestratorMetrics>>,
      ]
    | null = null;
  try {
    queried = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaces)
        .where(and(isNotNull(spaces.chatRoomId), eq(spaces.isArchived, false))),
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaceDiscussionSummaries),
      db.select({ count: sql<number>`count(*)` }).from(spaceCallTranscripts),
      db.select({ count: sql<number>`count(*)` }).from(spaceCallRecordings),
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaceDiscussionSummaries)
        .where(gte(spaceDiscussionSummaries.createdAt, since24h)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaceCallTranscripts)
        .where(gte(spaceCallTranscripts.createdAt, since24h)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaceCallRecordings)
        .where(gte(spaceCallRecordings.createdAt, since24h)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(spaceDiscussionSummaries)
        .where(gte(spaceDiscussionSummaries.createdAt, since7d)),
      getSignalOrchestratorMetrics({ db }),
    ]);
  } catch (error) {
    console.error('[space-memory.health] Failed to read health metrics', error);
    return NextResponse.json(
      {
        status: 'critical',
        generated_at: new Date().toISOString(),
        error: 'Failed to read health metrics',
      },
      { status: 503 },
    );
  }
  if (!queried) {
    return NextResponse.json(
      {
        status: 'critical',
        generated_at: new Date().toISOString(),
        error: 'Health metrics unavailable',
      },
      { status: 503 },
    );
  }
  const [
    spacesWithChatRow,
    summaryTotalRow,
    transcriptTotalRow,
    recordingTotalRow,
    summaries24h,
    transcripts24h,
    recordings24h,
    summaries7d,
    signalMetrics,
  ] = queried;

  const summaries_total = Number(summaryTotalRow[0]?.count ?? 0);
  const transcripts_total = Number(transcriptTotalRow[0]?.count ?? 0);
  const recordings_total = Number(recordingTotalRow[0]?.count ?? 0);
  const spaces_with_chat = Number(spacesWithChatRow[0]?.count ?? 0);
  const summaries_last_24h = Number(summaries24h[0]?.count ?? 0);
  const transcripts_last_24h = Number(transcripts24h[0]?.count ?? 0);
  const recordings_last_24h = Number(recordings24h[0]?.count ?? 0);
  const summaries_last_7d = Number(summaries7d[0]?.count ?? 0);

  const readiness = {
    ops_secret_configured: Boolean(configuredSecret),
    call_artifact_ingest_secret_configured: Boolean(
      process.env.HYPHA_CALL_ARTIFACT_INGEST_SECRET?.trim(),
    ),
    matrix_homeserver_configured: Boolean(
      process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim(),
    ),
    matrix_bot_access_token_configured: Boolean(
      process.env.HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN?.trim(),
    ),
    mcp_auth_token_configured: Boolean(
      process.env.HYPHA_MCP_AUTH_TOKEN?.trim(),
    ),
    mcp_matrix_request_url_configured: Boolean(
      process.env.HYPHA_MCP_MATRIX_REQUEST_URL?.trim() ||
        process.env.VERCEL_URL?.trim(),
    ),
  };

  const alerts: Array<{
    level: 'warn' | 'critical';
    code: string;
    message: string;
  }> = [];

  if (!readiness.call_artifact_ingest_secret_configured) {
    alerts.push({
      level: 'critical',
      code: 'missing_ingest_secret',
      message:
        'HYPHA_CALL_ARTIFACT_INGEST_SECRET is missing; call recordings/transcripts cannot be ingested securely.',
    });
  }
  if (!readiness.matrix_homeserver_configured) {
    alerts.push({
      level: 'critical',
      code: 'missing_matrix_homeserver',
      message:
        'NEXT_PUBLIC_MATRIX_HOMESERVER_URL is missing; discussion summary generation from Matrix chat cannot run.',
    });
  }
  if (!readiness.matrix_bot_access_token_configured) {
    alerts.push({
      level: 'warn',
      code: 'missing_matrix_bot_token',
      message:
        'HYPHA_MATRIX_ORG_MEMORY_ACCESS_TOKEN is missing; cron-style summary refresh may fail without user session tokens.',
    });
  }
  if (spaces_with_chat > 0 && summaries_last_7d === 0) {
    alerts.push({
      level: 'warn',
      code: 'no_recent_summaries',
      message:
        'No discussion summaries were generated in the last 7 days for spaces with chat rooms.',
    });
  }
  if (signalMetrics.queue_failed > 0) {
    alerts.push({
      level: 'warn',
      code: 'signal_orchestrator_failed_jobs',
      message: `Signal orchestrator has ${signalMetrics.queue_failed} failed queue items.`,
    });
  }

  const status = alerts.some((a) => a.level === 'critical')
    ? 'critical'
    : alerts.length > 0
    ? 'warn'
    : 'ok';

  return NextResponse.json({
    status,
    generated_at: new Date().toISOString(),
    readiness,
    metrics: {
      spaces_with_chat,
      summaries_total,
      transcripts_total,
      recordings_total,
      summaries_last_24h,
      transcripts_last_24h,
      recordings_last_24h,
      signal_orchestrator_queue_pending: signalMetrics.queue_pending,
      signal_orchestrator_queue_failed: signalMetrics.queue_failed,
      signals_emitted_last_24h: signalMetrics.signals_emitted_last_24h,
      relays_emitted_last_24h: signalMetrics.relays_emitted_last_24h,
    },
    signal_orchestrator: signalMetrics,
    alerts,
  });
}
