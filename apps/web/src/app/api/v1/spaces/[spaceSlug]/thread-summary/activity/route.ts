import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import {
  enqueueSignalEvaluationFromMemory,
  findSpaceBySlug,
  recordThreadActivity,
  refreshThreadSummary,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

const activitySchema = z.object({
  matrixRoomId: z.string().trim().min(1),
  threadKind: z.enum(['space', 'coherence']),
  coherenceSlug: z.string().trim().min(1).optional().nullable(),
  threadTitle: z.string().trim().min(1).optional().nullable(),
  lastMessageEventId: z.string().trim().min(1),
  lastMessageOriginServerTs: z.number().int().positive(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }

  if (space.web3SpaceId != null) {
    if (!canConvertToBigInt(space.web3SpaceId)) {
      return NextResponse.json(
        { error: 'Space has an invalid on-chain space id' },
        { status: 403 },
      );
    }
    const spaceId = Number(space.web3SpaceId);
    if (!Number.isFinite(spaceId)) {
      return NextResponse.json(
        { error: 'Space has an invalid on-chain space id' },
        { status: 403 },
      );
    }
    const { hasAccess, response } = await checkSpaceAccess(request, spaceId);
    if (!hasAccess) {
      return (
        response ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }
  }

  let parsed: ReturnType<typeof activitySchema.safeParse>;
  try {
    parsed = activitySchema.safeParse(await request.json());
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload' },
      { status: 400 },
    );
  }
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const authHeader = request.headers.get('authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  const bearer = bearerMatch?.[1]?.trim() || undefined;

  const payload = parsed.data;
  const recorded = await recordThreadActivity(
    {
      spaceSlug,
      matrixRoomId: payload.matrixRoomId,
      threadKind: payload.threadKind,
      coherenceSlug: payload.coherenceSlug,
      threadTitle: payload.threadTitle,
      lastMessageEventId: payload.lastMessageEventId,
      lastMessageOriginServerTs: payload.lastMessageOriginServerTs,
    },
    { db },
  );
  if (!recorded.ok) {
    return NextResponse.json({ error: recorded.error }, { status: 400 });
  }

  void refreshThreadSummary(
    {
      spaceSlug,
      matrixRoomId: payload.matrixRoomId,
      authToken: bearer,
      requestUrlForSessionMatrix: request.url,
    },
    { db },
  )
    .then(async (result) => {
      if (result.ok && !result.skipped) {
        try {
          await enqueueSignalEvaluationFromMemory(
            {
              spaceSlug,
              triggerKind: 'thread_summary',
              metadata: {
                matrixRoomId: payload.matrixRoomId,
                threadSummaryId: result.summary.id,
              },
            },
            { db },
          );
        } catch (enqueueError) {
          console.error('[thread-summary.activity] enqueue failed', {
            spaceSlug,
            error:
              enqueueError instanceof Error
                ? enqueueError.message
                : String(enqueueError),
          });
        }
      }
    })
    .catch((error) => {
      console.error('[thread-summary.activity] refresh failed', {
        spaceSlug,
        error: error instanceof Error ? error.message : String(error),
      });
    });

  return NextResponse.json({ ok: true });
}
