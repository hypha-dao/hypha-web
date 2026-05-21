import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import {
  createSpaceDiscussionSummary,
  enqueueSignalEvaluationFromMemory,
} from '@hypha-platform/core/server';
import { db, spaces } from '@hypha-platform/storage-postgres';
import { readOpsSecret } from '../../_lib/ops-auth';

export const maxDuration = 300;

const refreshPayloadSchema = z.object({
  space_slugs: z.array(z.string().trim().min(1)).max(500).optional(),
  limit: z.number().int().min(1).max(500).optional().default(100),
  include_archived: z.boolean().optional().default(false),
  dry_run: z.boolean().optional().default(false),
});
const SUMMARY_CONCURRENCY = 6;
const SUMMARY_TIMEOUT_MS = 45_000;

async function readPayload(request: NextRequest) {
  const body = await request.json();
  return refreshPayloadSchema.safeParse(body ?? {});
}

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

  let targetSlugs: string[];
  if (payload.space_slugs?.length) {
    targetSlugs = Array.from(
      new Set(payload.space_slugs.map((slug) => slug.trim()).filter(Boolean)),
    );
    if (targetSlugs.length > 500) {
      return NextResponse.json(
        {
          error: 'space_slugs exceeds supported batch size (500)',
        },
        { status: 400 },
      );
    }
  } else {
    try {
      const rows = await db
        .select({ slug: spaces.slug, chatRoomId: spaces.chatRoomId })
        .from(spaces)
        .where(
          and(
            isNotNull(spaces.chatRoomId),
            payload.include_archived ? undefined : eq(spaces.isArchived, false),
          ),
        )
        .orderBy(desc(spaces.updatedAt))
        .limit(payload.limit);
      targetSlugs = rows
        .filter((row) => Boolean(row.chatRoomId?.trim()))
        .map((row) => row.slug);
    } catch (error) {
      console.error(
        '[space-memory.refresh-discussions] Failed to resolve target spaces',
        error,
      );
      return NextResponse.json(
        { error: 'Failed to resolve target spaces' },
        { status: 503 },
      );
    }
  }

  if (payload.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      target_count: targetSlugs.length,
      target_slugs: targetSlugs,
    });
  }

  const summaries: Array<{
    space_slug: string;
    ok: boolean;
    summary_id?: number;
    message_count?: number;
    participant_count?: number;
    error?: string;
  }> = [];

  const queue = [...targetSlugs];
  const workers = Array.from({
    length: Math.min(SUMMARY_CONCURRENCY, targetSlugs.length),
  }).map(async () => {
    while (true) {
      const spaceSlug = queue.shift();
      if (!spaceSlug) return;
      try {
        const result = await withTimeout(
          (signal) =>
            createSpaceDiscussionSummary(
              { spaceSlug, source: 'cron', signal },
              { db },
            ),
          SUMMARY_TIMEOUT_MS,
          'Summary generation timed out',
        );
        if (result.ok) {
          try {
            await enqueueSignalEvaluationFromMemory(
              {
                spaceSlug,
                triggerKind: 'ops_refresh',
              },
              { db },
            );
          } catch (enqueueError) {
            console.error(
              '[space-memory.refresh-discussions] Failed to enqueue signal evaluation',
              {
                spaceSlug,
                error:
                  enqueueError instanceof Error
                    ? enqueueError.message
                    : String(enqueueError),
              },
            );
          }
          summaries.push({
            space_slug: spaceSlug,
            ok: true,
            summary_id: result.summaryId,
            message_count: result.messageCount,
            participant_count: result.participantCount,
          });
          continue;
        }
        summaries.push({
          space_slug: spaceSlug,
          ok: false,
          error: result.error,
        });
      } catch (error) {
        summaries.push({
          space_slug: spaceSlug,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });
  await Promise.allSettled(workers);

  const success_count = summaries.filter((s) => s.ok).length;
  const failure_count = summaries.length - success_count;
  const status = failure_count === 0 ? 200 : 207;

  return NextResponse.json(
    {
      ok: failure_count === 0,
      target_count: targetSlugs.length,
      success_count,
      failure_count,
      results: summaries,
    },
    { status },
  );
}
