import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  enqueueSignalEvaluationFromMemory,
  listThreadSummariesDueForRefresh,
  refreshThreadSummary,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { readOpsSecret } from '../../_lib/ops-auth';

export const maxDuration = 300;

const refreshPayloadSchema = z.object({
  limit: z.number().int().min(1).max(500).optional().default(100),
  dry_run: z.boolean().optional().default(false),
});

const REFRESH_CONCURRENCY = 4;
const REFRESH_TIMEOUT_MS = 60_000;

async function withTimeout<T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error(timeoutMessage)),
    timeoutMs,
  );
  try {
    return await task(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(timeoutMessage);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
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

  let parsedPayload: ReturnType<typeof refreshPayloadSchema.safeParse>;
  try {
    parsedPayload = refreshPayloadSchema.safeParse(await request.json());
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

  const targets = await listThreadSummariesDueForRefresh(
    { limit: payload.limit },
    { db },
  );

  if (payload.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      target_count: targets.length,
      targets,
    });
  }

  type ResultRow = {
    space_slug: string;
    matrix_room_id: string;
    ok: boolean;
    skipped?: boolean;
    reason?: string;
    summary_id?: number;
    error?: string;
  };
  const results: ResultRow[] = [];
  const queue = [...targets];

  const workers = Array.from({
    length: Math.min(REFRESH_CONCURRENCY, queue.length || 1),
  }).map(async () => {
    while (true) {
      const target = queue.shift();
      if (!target) return;
      try {
        const result = await withTimeout(
          (signal) =>
            refreshThreadSummary(
              {
                spaceSlug: target.spaceSlug,
                matrixRoomId: target.matrixRoomId,
                signal,
              },
              { db },
            ),
          REFRESH_TIMEOUT_MS,
          'Thread summary refresh timed out',
        );
        if (!result.ok) {
          results.push({
            space_slug: target.spaceSlug,
            matrix_room_id: target.matrixRoomId,
            ok: false,
            error: result.error,
          });
          continue;
        }
        if (result.skipped) {
          results.push({
            space_slug: target.spaceSlug,
            matrix_room_id: target.matrixRoomId,
            ok: true,
            skipped: true,
            reason: result.reason,
          });
          continue;
        }
        try {
          await enqueueSignalEvaluationFromMemory(
            {
              spaceSlug: target.spaceSlug,
              triggerKind: 'thread_summary',
              metadata: {
                matrixRoomId: target.matrixRoomId,
                threadSummaryId: result.summary.id,
              },
            },
            { db },
          );
        } catch (enqueueError) {
          console.error(
            '[space-memory.refresh-thread-summaries] enqueue failed',
            {
              spaceSlug: target.spaceSlug,
              error:
                enqueueError instanceof Error
                  ? enqueueError.message
                  : String(enqueueError),
            },
          );
        }
        results.push({
          space_slug: target.spaceSlug,
          matrix_room_id: target.matrixRoomId,
          ok: true,
          summary_id: result.summary.id,
        });
      } catch (error) {
        results.push({
          space_slug: target.spaceSlug,
          matrix_room_id: target.matrixRoomId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
  await Promise.allSettled(workers);

  const success_count = results.filter((r) => r.ok && !r.skipped).length;
  const skipped_count = results.filter((r) => r.ok && r.skipped).length;
  const failure_count = results.filter((r) => !r.ok).length;
  const status = failure_count === 0 ? 200 : 207;

  return NextResponse.json(
    {
      ok: failure_count === 0,
      target_count: targets.length,
      success_count,
      skipped_count,
      failure_count,
      results,
    },
    { status },
  );
}
