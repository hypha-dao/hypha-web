import { NextResponse } from 'next/server';
import { runRefreshDiscussions } from '../../v1/ops/space-memory/refresh-discussions/run-refresh-discussions';
import { assertCronAuth } from '../_lib/assert-cron-auth';

export const maxDuration = 300;

/**
 * Batch-refresh discussion summaries and enqueue signal evaluations.
 * Vercel Cron: GET with Authorization Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const limit = Math.min(
    500,
    Math.max(
      1,
      Number.parseInt(url.searchParams.get('limit') ?? '100', 10) || 100,
    ),
  );
  const includeArchived = url.searchParams.get('include_archived') === 'true';
  const dryRun = url.searchParams.get('dry_run') === 'true';

  const { status, body } = await runRefreshDiscussions({
    limit,
    includeArchived,
    dryRun,
  });
  return NextResponse.json(body, { status });
}
