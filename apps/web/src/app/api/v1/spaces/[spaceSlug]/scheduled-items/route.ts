import { NextRequest, NextResponse } from 'next/server';
import {
  createScheduledItem,
  findScheduledItemsBySpaceId,
  findSelf,
  findSpaceBySlug,
  getDb,
  schemaCreateScheduledItem,
  schemaScheduledItemsRangeQuery,
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

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) {
        return response;
      }
    }

    const range = parseRange(new URL(request.url));
    if (!range?.success) {
      return NextResponse.json(
        { error: 'Query params "from" and "to" (ISO dates) are required' },
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

    return NextResponse.json({ data: items });
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

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) {
        return response;
      }
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

    const body = await request.json();
    const validated = schemaCreateScheduledItem.parse({
      ...body,
      spaceId: space.id,
    });

    const created = await createScheduledItem(
      {
        ...validated,
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
