import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  cleanupSpaceCallArtifactsRetention,
  cleanupSignalOrchestratorRetention,
  cleanupSpaceDiscussionSummariesRetention,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { readOpsSecret } from '../../_lib/ops-auth';

const retentionPayloadSchema = z.object({
  dry_run: z.boolean().optional().default(true),
  discussion_summary_retention_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .default(120),
  call_recording_retention_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .default(365),
  call_transcript_retention_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .default(365),
  call_ingest_run_retention_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .default(45),
  orchestrator_dispatch_retention_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .default(90),
  orchestrator_queue_terminal_retention_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .default(30),
  orchestrator_queue_failed_retention_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .default(45),
  orchestrator_cooldown_grace_days: z
    .number()
    .int()
    .min(1)
    .max(3650)
    .optional()
    .default(7),
});

async function readPayload(request: NextRequest) {
  const body = await request.json();
  return retentionPayloadSchema.safeParse(body ?? {});
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

  let parsedPayload: ReturnType<typeof retentionPayloadSchema.safeParse>;
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

  try {
    const [summaries, callArtifacts, orchestrator] = await Promise.all([
      cleanupSpaceDiscussionSummariesRetention(
        {
          dryRun: payload.dry_run,
          retentionDays: payload.discussion_summary_retention_days,
        },
        { db },
      ),
      cleanupSpaceCallArtifactsRetention(
        {
          dryRun: payload.dry_run,
          recordingRetentionDays: payload.call_recording_retention_days,
          transcriptRetentionDays: payload.call_transcript_retention_days,
          ingestRunRetentionDays: payload.call_ingest_run_retention_days,
        },
        { db },
      ),
      cleanupSignalOrchestratorRetention(
        {
          dryRun: payload.dry_run,
          dispatchRetentionDays: payload.orchestrator_dispatch_retention_days,
          queueTerminalRetentionDays:
            payload.orchestrator_queue_terminal_retention_days,
          queueFailedRetentionDays:
            payload.orchestrator_queue_failed_retention_days,
          cooldownGraceDays: payload.orchestrator_cooldown_grace_days,
        },
        { db },
      ),
    ]);

    return NextResponse.json({
      ok: true,
      dry_run: payload.dry_run,
      discussion_summaries: summaries,
      call_artifacts: callArtifacts,
      signal_orchestrator: orchestrator,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to run retention cleanup',
        code: 'SPACE_MEMORY_RETENTION_FAILED',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
