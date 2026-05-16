import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processSignalOrchestratorBatch } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { readOpsSecret } from '../../_lib/ops-auth';

const orchestratePayloadSchema = z.object({
  limit: z.number().int().min(1).max(200).optional().default(40),
  dry_run: z.boolean().optional().default(false),
});

async function readPayload(request: NextRequest) {
  const body = await request.json();
  return orchestratePayloadSchema.safeParse(body ?? {});
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

  let parsedPayload: ReturnType<typeof orchestratePayloadSchema.safeParse>;
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

  const result = await processSignalOrchestratorBatch(
    {
      limit: parsedPayload.data.limit,
      dryRun: parsedPayload.data.dry_run,
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
}
