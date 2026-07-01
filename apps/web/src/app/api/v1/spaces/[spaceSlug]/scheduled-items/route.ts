import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  buildPaginatedResponse,
  checkSpaceAccessForSpace,
  createScheduledItem,
  findScheduledItemsBySpaceId,
  mapScheduledItemRow,
  findScheduledItemsByCoherenceId,
  findSelf,
  findSpaceBySlug,
  getDb,
  parseHttpPaginationParams,
  schemaCreateScheduledItem,
  schemaScheduledItemsRangeQuery,
  assertCoherenceInSpace,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { dispatchScheduledItemInvitation } from '@hypha-platform/notifications/server';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { PrivyClient } from '@privy-io/node';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

type Params = { spaceSlug: string };

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? '';

function parseRange(url: URL) {
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');
  if (!fromRaw || !toRaw) {
    return null;
  }
  return schemaScheduledItemsRangeQuery.safeParse({
    from: fromRaw,
    to: toRaw,
  });
}

async function assertScheduledItemsReadAccess(
  request: NextRequest,
  space: NonNullable<Awaited<ReturnType<typeof findSpaceBySlug>>>,
) {
  if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );
    if (!hasAccess && response) {
      return response;
    }
    return null;
  }

  const authToken = request.headers.get('Authorization')?.split(' ')[1];
  const gate = await checkSpaceAccessForSpace(space, authToken, {
    requireMembershipWhenOffChain: true,
  });
  if (!gate.hasAccess) {
    return NextResponse.json(
      { error: gate.message ?? 'Forbidden' },
      { status: gate.httpStatus ?? 403 },
    );
  }

  return null;
}

async function assertScheduledItemsWriteAccess(
  spaceSlug: string,
  authToken: string,
) {
  const interactionAuth = await authorizeSpacePanelInteraction({
    spaceSlug,
    authToken,
  });
  if (!interactionAuth.authorized) {
    return NextResponse.json(
      { error: interactionAuth.message },
      { status: 403 },
    );
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const accessResponse = await assertScheduledItemsReadAccess(request, space);
    if (accessResponse) {
      return accessResponse;
    }

    const url = new URL(request.url);
    const coherenceIdRaw = url.searchParams.get('coherenceId');
    if (coherenceIdRaw) {
      const coherenceId = Number.parseInt(coherenceIdRaw, 10);
      if (!Number.isInteger(coherenceId) || coherenceId <= 0) {
        return NextResponse.json(
          { error: 'Invalid coherenceId query param' },
          { status: 400 },
        );
      }

      const { page, pageSize } = parseHttpPaginationParams(url, {
        defaultPageSize: 50,
      });
      const result = await findScheduledItemsByCoherenceId(
        { spaceId: space.id, coherenceId, page, pageSize },
        { db },
      );
      return NextResponse.json(
        buildPaginatedResponse(
          result.items,
          result.total,
          result.page,
          result.pageSize,
        ),
      );
    }

    const range = parseRange(url);
    if (!range) {
      return NextResponse.json(
        { error: 'Query params "from" and "to" (ISO dates) are required' },
        { status: 400 },
      );
    }
    if (!range.success) {
      return NextResponse.json(
        {
          error: 'Invalid date range',
          details: range.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { page, pageSize } = parseHttpPaginationParams(new URL(request.url), {
      defaultPageSize: 100,
    });
    const result = await findScheduledItemsBySpaceId(
      {
        spaceId: space.id,
        from: range.data.from,
        to: range.data.to,
        page,
        pageSize,
      },
      { db },
    );

    return NextResponse.json(
      buildPaginatedResponse(
        result.items,
        result.total,
        result.page,
        result.pageSize,
      ),
    );
  } catch (error) {
    console.error('Failed to fetch scheduled items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled items' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    const authToken = parseBearerToken(request.headers.get('Authorization'));
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const accessResponse = await assertScheduledItemsWriteAccess(
      spaceSlug,
      authToken,
    );
    if (accessResponse) {
      return accessResponse;
    }

    const privy = new PrivyClient({
      appId: PRIVY_APP_ID,
      appSecret: PRIVY_APP_SECRET,
    });
    const { user_id: privyUserId } = await privy
      .utils()
      .auth()
      .verifyAuthToken(authToken);
    const authDb = getDb({ authToken });
    const self = await findSelf({ db: authDb });
    if (!self?.id || self.sub !== privyUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (body == null) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const parsed = schemaCreateScheduledItem.safeParse({
      ...body,
      spaceId: space.id,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    try {
      await assertCoherenceInSpace(
        { coherenceId: parsed.data.coherenceId, spaceId: space.id },
        { db },
      );
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'Linked signal must belong to this space',
        },
        { status: 400 },
      );
    }

    const created = await createScheduledItem(
      {
        ...parsed.data,
        creatorId: self.id,
      },
      {
        db,
        space: { slug: space.slug, chatRoomId: space.chatRoomId ?? null },
        lang: request.headers.get('x-hypha-locale')?.trim() || 'en',
      },
    );

    const lang = request.headers.get('x-hypha-locale')?.trim() || 'en';
    try {
      await dispatchScheduledItemInvitation(
        {
          item: mapScheduledItemRow(created),
          spaceSlug: space.slug,
          spaceTitle: space.title,
          lang,
        },
        { db },
      );
    } catch (inviteError) {
      console.error(
        'Failed to dispatch scheduled item invitation:',
        inviteError,
      );
    }

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error('Failed to create scheduled item:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled item' },
      { status: 500 },
    );
  }
}
