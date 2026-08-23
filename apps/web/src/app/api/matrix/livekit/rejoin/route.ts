import { NextRequest, NextResponse } from 'next/server';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';
import {
  determineEnvironment,
  evictStaleLivekitParticipants,
} from '@hypha-platform/core/server';
import {
  resolveMatrixAccessToken,
  verifyPrivyToken,
} from '../../room-call-permissions/_lib';

/**
 * Evicts the caller's own stale LiveKit participant(s) from a call room, ahead of a fresh rejoin
 * ("Refresh call" — #2456 D2, scenarios 1 and 3). Only ever targets the authenticated caller's own
 * Matrix user id, resolved server-side from their Privy session — never a client-supplied target,
 * so one user can never evict another's call session.
 */
export async function POST(request: NextRequest) {
  const humanChatEnabled = await getEnableHumanChat();
  const authHeader = request.headers.get('Authorization');
  if (!humanChatEnabled || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const authToken = authHeader.slice('Bearer '.length).trim();
  const privyUserId = await verifyPrivyToken(authToken);
  if (!privyUserId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    roomId?: unknown;
  } | null;
  const rawRoomId = body?.roomId;
  const roomId = typeof rawRoomId === 'string' ? rawRoomId.trim() : '';
  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required' }, { status: 400 });
  }

  const environment = determineEnvironment(request.url);
  const callerAccess = await resolveMatrixAccessToken(environment, privyUserId);
  if (!callerAccess) {
    return NextResponse.json(
      { error: 'Matrix session unavailable for caller' },
      { status: 403 },
    );
  }

  const result = await evictStaleLivekitParticipants({
    matrixRoomId: roomId,
    matrixUserId: callerAccess.userId,
  });
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true, evictedCount: result.evictedCount });
}
