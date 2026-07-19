import { and, desc, eq, isNotNull } from 'drizzle-orm';
import {
  createSpaceDiscussionSummary,
  enqueueSignalEvaluationFromMemory,
} from '@hypha-platform/core/server';
import { db, spaces } from '@hypha-platform/storage-postgres';

export type RefreshDiscussionsInput = {
  spaceSlugs?: string[];
  limit?: number;
  includeArchived?: boolean;
  dryRun?: boolean;
};

export type RefreshDiscussionsResult = {
  ok: boolean;
  dry_run?: boolean;
  target_count: number;
  target_slugs?: string[];
  success_count?: number;
  failure_count?: number;
  results?: Array<{
    space_slug: string;
    ok: boolean;
    summary_id?: number;
    message_count?: number;
    participant_count?: number;
    error?: string;
  }>;
  error?: string;
};

const SUMMARY_CONCURRENCY = 6;
const SUMMARY_TIMEOUT_MS = 45_000;

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

export async function runRefreshDiscussions(
  input: RefreshDiscussionsInput = {},
): Promise<{ status: number; body: RefreshDiscussionsResult }> {
  const limit = input.limit ?? 100;
  const includeArchived = input.includeArchived ?? false;
  const dryRun = input.dryRun ?? false;

  let targetSlugs: string[];
  if (input.spaceSlugs?.length) {
    targetSlugs = Array.from(
      new Set(input.spaceSlugs.map((slug) => slug.trim()).filter(Boolean)),
    );
    if (targetSlugs.length > 500) {
      return {
        status: 400,
        body: {
          ok: false,
          target_count: 0,
          error: 'space_slugs exceeds supported batch size (500)',
        },
      };
    }
  } else {
    try {
      const rows = await db
        .select({ slug: spaces.slug, chatRoomId: spaces.chatRoomId })
        .from(spaces)
        .where(
          and(
            isNotNull(spaces.chatRoomId),
            includeArchived ? undefined : eq(spaces.isArchived, false),
          ),
        )
        .orderBy(desc(spaces.updatedAt))
        .limit(limit);
      targetSlugs = rows
        .filter((row) => Boolean(row.chatRoomId?.trim()))
        .map((row) => row.slug);
    } catch (error) {
      console.error(
        '[space-memory.refresh-discussions] Failed to resolve target spaces',
        error,
      );
      return {
        status: 503,
        body: {
          ok: false,
          target_count: 0,
          error: 'Failed to resolve target spaces',
        },
      };
    }
  }

  if (dryRun) {
    return {
      status: 200,
      body: {
        ok: true,
        dry_run: true,
        target_count: targetSlugs.length,
        target_slugs: targetSlugs,
      },
    };
  }

  const summaries: NonNullable<RefreshDiscussionsResult['results']> = [];
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

  return {
    status: failure_count === 0 ? 200 : 207,
    body: {
      ok: failure_count === 0,
      target_count: targetSlugs.length,
      success_count,
      failure_count,
      results: summaries,
    },
  };
}
