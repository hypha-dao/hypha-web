import { NextRequest, NextResponse } from 'next/server';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import {
  db,
  spaceCallRecordings,
  spaceCallTranscripts,
  spaceDiscussionSummaries,
  spaces,
} from '@hypha-platform/storage-postgres';

function readOpsSecret(request: NextRequest): string {
  return (
    request.headers.get('x-hypha-ops-secret')?.trim() ??
    request.headers
      .get('authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim() ??
    ''
  );
}

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

  const [
    spacesWithChatRow,
    summaryTotalRow,
    transcriptTotalRow,
    recordingTotalRow,
    summaries24h,
    transcripts24h,
    recordings24h,
    summaries7d,
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
  ]);

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
    },
    alerts,
  });
}
