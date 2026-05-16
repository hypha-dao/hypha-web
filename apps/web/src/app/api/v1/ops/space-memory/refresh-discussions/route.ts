import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { z } from 'zod';
import { createSpaceDiscussionSummary } from '@hypha-platform/core/server';
import { db, spaces } from '@hypha-platform/storage-postgres';

const refreshPayloadSchema = z.object({
  space_slugs: z.array(z.string().trim().min(1)).optional(),
  limit: z.number().int().min(1).max(500).optional().default(100),
  include_archived: z.boolean().optional().default(false),
  dry_run: z.boolean().optional().default(false),
});

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

async function readPayload(request: NextRequest) {
  try {
    const body = await request.json();
    return refreshPayloadSchema.safeParse(body ?? {});
  } catch {
    return refreshPayloadSchema.safeParse({});
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

  const parsedPayload = await readPayload(request);
  if (!parsedPayload.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsedPayload.error.flatten() },
      { status: 400 },
    );
  }
  const payload = parsedPayload.data;

  const targetSlugs = payload.space_slugs?.length
    ? Array.from(
        new Set(payload.space_slugs.map((slug) => slug.trim()).filter(Boolean)),
      )
    : (
        await db
          .select({ slug: spaces.slug, chatRoomId: spaces.chatRoomId })
          .from(spaces)
          .where(
            and(
              isNotNull(spaces.chatRoomId),
              payload.include_archived
                ? undefined
                : eq(spaces.isArchived, false),
            ),
          )
          .orderBy(desc(spaces.updatedAt))
          .limit(payload.limit)
      )
        .filter((row) => Boolean(row.chatRoomId?.trim()))
        .map((row) => row.slug);

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

  for (const spaceSlug of targetSlugs) {
    const result = await createSpaceDiscussionSummary(
      { spaceSlug, source: 'cron' },
      { db },
    );
    if (result.ok) {
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
  }

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
