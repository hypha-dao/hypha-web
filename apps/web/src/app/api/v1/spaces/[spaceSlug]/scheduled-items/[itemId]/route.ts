import { NextRequest, NextResponse } from 'next/server';
import {
  deleteScheduledItemById,
  findScheduledItemById,
  findSelf,
  findSpaceBySlug,
  getDb,
  schemaUpdateScheduledItem,
  updateScheduledItemById,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { PrivyClient } from '@privy-io/node';

type Params = { spaceSlug: string; itemId: string };

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET ?? '';

async function authorizeRequest(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!authToken) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
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
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { authToken, self };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, itemId } = await params;
  const id = Number.parseInt(itemId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  try {
    const auth = await authorizeRequest(request);
    if ('error' in auth && auth.error) return auth.error;

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const existing = await findScheduledItemById({ id }, { db });
    if (!existing || existing.spaceId !== space.id) {
      return NextResponse.json(
        { error: 'Scheduled item not found' },
        { status: 404 },
      );
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

    const body = await request.json();
    const validated = schemaUpdateScheduledItem.parse({ ...body, id });
    const { id: _id, ...updates } = validated;

    const updated = await updateScheduledItemById(
      { id, ...updates },
      {
        db,
        space: { slug: space.slug, chatRoomId: space.chatRoomId ?? null },
        lang: request.headers.get('x-hypha-locale')?.trim() || 'en',
      },
    );
    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error('Failed to update scheduled item:', error);
    return NextResponse.json(
      { error: 'Failed to update scheduled item' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, itemId } = await params;
  const id = Number.parseInt(itemId, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: 'Invalid item id' }, { status: 400 });
  }

  try {
    const auth = await authorizeRequest(request);
    if ('error' in auth && auth.error) return auth.error;

    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const existing = await findScheduledItemById({ id }, { db });
    if (!existing || existing.spaceId !== space.id) {
      return NextResponse.json(
        { error: 'Scheduled item not found' },
        { status: 404 },
      );
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

    await deleteScheduledItemById({ id }, { db });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete scheduled item:', error);
    return NextResponse.json(
      { error: 'Failed to delete scheduled item' },
      { status: 500 },
    );
  }
}
