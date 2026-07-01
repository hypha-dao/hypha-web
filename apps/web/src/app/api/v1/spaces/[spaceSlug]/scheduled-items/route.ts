import { NextRequest, NextResponse } from 'next/server';
import {
  authorizeSpacePanelInteraction,
  checkSpaceAccessForSpace,
  createScheduledItem,
  findScheduledItemsBySpaceId,
  findSelf,
  findSpaceBySlug,
  getDb,
  schemaCreateScheduledItem,
  schemaScheduledItemsRangeQuery,
  type PaginatedResponse,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { PrivyClient } from '@privy-io/node';

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
  request: NextRequest,
  spaceSlug: string,
  authToken: string,
) {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (space?.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );
    if (!hasAccess && response) {
      return response;
    }
    return null;
  }

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

    const range = parseRange(new URL(request.url));
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

    const items = await findScheduledItemsBySpaceId(
      {
        spaceId: space.id,
        from: range.data.from,
        to: range.data.to,
      },
      { db },
    );

    const response: PaginatedResponse<(typeof items)[number]> = {
      data: items,
      pagination: {
        total: items.length,
        page: 1,
        pageSize: items.length,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    return NextResponse.json(response);
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
    const authToken = request.headers.get('Authorization')?.split(' ')[1];
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const accessResponse = await assertScheduledItemsWriteAccess(
      request,
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

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    console.error('Failed to create scheduled item:', error);
    return NextResponse.json(
      { error: 'Failed to create scheduled item' },
      { status: 500 },
    );
  }
}
