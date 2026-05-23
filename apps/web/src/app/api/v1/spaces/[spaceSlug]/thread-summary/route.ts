import { NextRequest, NextResponse } from 'next/server';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import {
  findSpaceBySlug,
  getThreadSummaryForRoom,
  refreshThreadSummary,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

async function authorizeSpace(
  request: NextRequest,
  spaceSlug: string,
): Promise<
  { ok: true; bearer?: string } | { ok: false; response: NextResponse }
> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Space not found' },
        { status: 404 },
      ),
    };
  }
  if (space.web3SpaceId != null) {
    if (!canConvertToBigInt(space.web3SpaceId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Space has an invalid on-chain space id' },
          { status: 403 },
        ),
      };
    }
    const spaceId = Number(space.web3SpaceId);
    if (!Number.isFinite(spaceId)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Space has an invalid on-chain space id' },
          { status: 403 },
        ),
      };
    }
    const { hasAccess, response } = await checkSpaceAccess(request, spaceId);
    if (!hasAccess) {
      return {
        ok: false,
        response:
          response ??
          NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      };
    }
  }
  const authHeader = request.headers.get('authorization');
  const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
  return { ok: true, bearer: bearerMatch?.[1]?.trim() || undefined };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const matrixRoomId = request.nextUrl.searchParams.get('matrixRoomId')?.trim();
  if (!matrixRoomId) {
    return NextResponse.json(
      { error: 'matrixRoomId query parameter is required' },
      { status: 400 },
    );
  }

  const auth = await authorizeSpace(request, spaceSlug);
  if (!auth.ok) return auth.response;

  const summary = await getThreadSummaryForRoom(
    { spaceSlug, matrixRoomId },
    { db },
  );
  return NextResponse.json({ summary });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const auth = await authorizeSpace(request, spaceSlug);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Malformed JSON payload' },
      { status: 400 },
    );
  }

  const matrixRoomId =
    typeof body === 'object' &&
    body &&
    'matrixRoomId' in body &&
    typeof (body as { matrixRoomId?: unknown }).matrixRoomId === 'string'
      ? (body as { matrixRoomId: string }).matrixRoomId.trim()
      : '';
  if (!matrixRoomId) {
    return NextResponse.json(
      { error: 'matrixRoomId is required' },
      { status: 400 },
    );
  }

  const refreshResult = await refreshThreadSummary(
    {
      spaceSlug,
      matrixRoomId,
      authToken: auth.bearer,
      requestUrlForSessionMatrix: request.url,
      force: false,
    },
    { db },
  );

  if (!refreshResult.ok) {
    return NextResponse.json({ error: refreshResult.error }, { status: 400 });
  }
  if (refreshResult.skipped) {
    const summary = await getThreadSummaryForRoom(
      { spaceSlug, matrixRoomId },
      { db },
    );
    return NextResponse.json({
      skipped: true,
      reason: refreshResult.reason,
      summary,
    });
  }
  return NextResponse.json({ summary: refreshResult.summary });
}
