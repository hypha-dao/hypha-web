import { NextRequest, NextResponse } from 'next/server';

import { findSpaceHostFieldsByChatRoomId } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { roomId: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { roomId } = await params;
  const trimmedRoomId = roomId?.trim();
  if (!trimmedRoomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  try {
    const space = await findSpaceHostFieldsByChatRoomId(
      { roomId: trimmedRoomId },
      { db },
    );
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const access = await checkSpaceAccess(request, space.web3SpaceId);
      if (!access.hasAccess) {
        return (
          access.response ??
          NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        );
      }
    }

    return NextResponse.json({
      spaceSlug: space.slug,
      spaceTitle: space.title,
      roomId: space.chatRoomId,
    });
  } catch (error) {
    console.error('[matrix/rooms/space] lookup failed:', error);
    return NextResponse.json(
      { error: 'Failed to resolve space' },
      { status: 500 },
    );
  }
}
