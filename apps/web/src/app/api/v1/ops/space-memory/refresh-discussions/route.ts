import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { readOpsSecret } from '../../_lib/ops-auth';
import { runRefreshDiscussions } from './run-refresh-discussions';

export const maxDuration = 300;

const refreshPayloadSchema = z.object({
  space_slugs: z.array(z.string().trim().min(1)).max(500).optional(),
  limit: z.number().int().min(1).max(500).optional().default(100),
  include_archived: z.boolean().optional().default(false),
  dry_run: z.boolean().optional().default(false),
});

async function readPayload(request: NextRequest) {
  const body = await request.json();
  return refreshPayloadSchema.safeParse(body ?? {});
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

  const { status, body } = await runRefreshDiscussions({
    spaceSlugs: parsedPayload.data.space_slugs,
    limit: parsedPayload.data.limit,
    includeArchived: parsedPayload.data.include_archived,
    dryRun: parsedPayload.data.dry_run,
  });

  return NextResponse.json(body, { status });
}
