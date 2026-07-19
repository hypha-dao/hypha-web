import { NextResponse } from 'next/server';
import { processSignalOrchestratorBatch } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { assertCronAuth } from '../_lib/assert-cron-auth';

export const maxDuration = 300;

/**
 * Drain due signal-orchestrator queue items (emit / relay / discard).
 * Vercel Cron: GET with Authorization Bearer CRON_SECRET.
 */
export async function GET(request: Request) {
  const unauthorized = assertCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const limit = Math.min(
    200,
    Math.max(
      1,
      Number.parseInt(url.searchParams.get('limit') ?? '40', 10) || 40,
    ),
  );
  const dryRun = url.searchParams.get('dry_run') === 'true';

  try {
    const result = await processSignalOrchestratorBatch(
      {
        limit,
        dryRun,
        requestUrlForSessionMatrix:
          process.env.HYPHA_MCP_MATRIX_REQUEST_URL?.trim() ||
          (process.env.VERCEL_URL?.trim()
            ? `https://${process.env.VERCEL_URL.trim()}`
            : undefined),
      },
      { db },
    );

    const status =
      result.results.some((row) => row.status === 'error') ||
      result.results.some((row) => row.status === 'discarded')
        ? 207
        : 200;
    return NextResponse.json(result, { status });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to orchestrate signals',
        code: 'SIGNAL_ORCHESTRATE_FAILED',
        detail: error instanceof Error ? error.message : String(error),
        context: { limit },
      },
      { status: 500 },
    );
  }
}
