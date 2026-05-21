import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enqueueSignalEvaluationFromMemory,
  findSpaceHostFieldsBySlug,
  getSpaceCallRecordingBySessionId,
  getSpaceCallTranscriptBySessionId,
  listSpaceCallArtifactIngestRunsForRetry,
  recordSpaceCallArtifactIngestEvent,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { readOpsSecret } from '../../_lib/ops-auth';

const reprocessPayloadSchema = z.object({
  dry_run: z.boolean().optional().default(false),
  space_slug: z.string().trim().min(1).optional(),
  limit: z.number().int().min(1).max(500).optional().default(100),
});

async function readPayload(request: NextRequest) {
  const body = await request.json();
  return reprocessPayloadSchema.safeParse(body ?? {});
}

export async function POST(request: NextRequest) {
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

  let parsedPayload: ReturnType<typeof reprocessPayloadSchema.safeParse>;
  try {
    parsedPayload = await readPayload(request);
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload' },
      { status: 400 },
    );
  }
  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsedPayload.error.flatten() },
      { status: 400 },
    );
  }

  const payload = parsedPayload.data;
  let spaceId: number | undefined;
  if (payload.space_slug) {
    const host = await findSpaceHostFieldsBySlug({ slug: payload.space_slug }, { db });
    if (!host) {
      return NextResponse.json(
        { error: `Space not found: ${payload.space_slug}` },
        { status: 404 },
      );
    }
    spaceId = host.id;
  }

  const runs = await listSpaceCallArtifactIngestRunsForRetry(
    {
      spaceId,
      limit: payload.limit,
    },
    { db },
  );

  if (payload.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      candidates: runs.map((run) => ({
        id: run.id,
        space_id: run.spaceId,
        call_session_id: run.callSessionId,
        state: run.state,
        attempts: run.attempts,
        next_retry_at: run.nextRetryAt,
      })),
    });
  }

  const results: Array<{
    id: number;
    space_id: number;
    call_session_id: string;
    status: 'requeued' | 'skipped_no_artifacts' | 'failed';
    detail?: string;
  }> = [];

  for (const run of runs) {
    try {
      const [recording, transcript] = await Promise.all([
        getSpaceCallRecordingBySessionId(
          { spaceId: run.spaceId, callSessionId: run.callSessionId },
          { db },
        ),
        getSpaceCallTranscriptBySessionId(
          { spaceId: run.spaceId, callSessionId: run.callSessionId },
          { db },
        ),
      ]);
      if (!recording && !transcript) {
        await recordSpaceCallArtifactIngestEvent(
          {
            spaceId: run.spaceId,
            callSessionId: run.callSessionId,
            state: 'retry_pending',
            nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            lastError: 'No recording/transcript artifacts found during reprocess',
          },
          { db },
        );
        results.push({
          id: run.id,
          space_id: run.spaceId,
          call_session_id: run.callSessionId,
          status: 'skipped_no_artifacts',
        });
        continue;
      }

      const host = await db.query.spaces.findFirst({
        columns: { slug: true },
        where: (spaces, { eq }) => eq(spaces.id, run.spaceId),
      });
      if (!host?.slug?.trim()) {
        throw new Error(`space slug not found for spaceId=${run.spaceId}`);
      }
      await enqueueSignalEvaluationFromMemory(
        {
          spaceSlug: host.slug,
          triggerKind: 'memory_ingest',
        },
        { db },
      );
      await recordSpaceCallArtifactIngestEvent(
        {
          spaceId: run.spaceId,
          callSessionId: run.callSessionId,
          state: 'ingested',
          lastError: null,
          nextRetryAt: null,
          recordingStored: Boolean(recording),
          transcriptStored: Boolean(transcript),
          metadata: { reprocessedAt: new Date().toISOString() },
        },
        { db },
      );
      results.push({
        id: run.id,
        space_id: run.spaceId,
        call_session_id: run.callSessionId,
        status: 'requeued',
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      await recordSpaceCallArtifactIngestEvent(
        {
          spaceId: run.spaceId,
          callSessionId: run.callSessionId,
          state: 'retry_pending',
          incrementAttempts: true,
          nextRetryAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          lastError: detail,
        },
        { db },
      );
      results.push({
        id: run.id,
        space_id: run.spaceId,
        call_session_id: run.callSessionId,
        status: 'failed',
        detail,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dry_run: false,
    processed: runs.length,
    requeued: results.filter((r) => r.status === 'requeued').length,
    skipped_no_artifacts: results.filter(
      (r) => r.status === 'skipped_no_artifacts',
    ).length,
    failed: results.filter((r) => r.status === 'failed').length,
    results,
  });
}
