import { NextRequest, NextResponse } from 'next/server';

import { findCoherenceByRoomId } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
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
    const signal = await findCoherenceByRoomId(
      { roomId: trimmedRoomId },
      { db },
    );
    if (!signal) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 });
    }

    const access = await checkSpaceAccess(request, signal.spaceId);
    if (!access.hasAccess) {
      return (
        access.response ??
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }

    return NextResponse.json({
      signalSlug: signal.slug,
      signalTitle: signal.title,
      spaceSlug: signal.spaceSlug,
      roomId: signal.roomId,
    });
  } catch (error) {
    console.error('[matrix/rooms/signal] lookup failed:', error);
    return NextResponse.json(
      { error: 'Failed to resolve signal thread' },
      { status: 500 },
    );
  }
}
