import { NextRequest, NextResponse } from 'next/server';
import {
  createBotOwnedRoomAction,
  determineEnvironment,
  ensureMemberJoinedRoomAction,
  findMatrixUserIdsByPersonIds,
  findPersonById,
  resolvePersonFromAuthToken,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

function networkDmAliasLocalpart(a: number, b: number): string {
  return `network-dm-${Math.min(a, b)}-${Math.max(a, b)}`;
}

export async function POST(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  const caller = await resolvePersonFromAuthToken(authToken);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const environment = determineEnvironment(request.url);
  if (!environment) {
    return NextResponse.json(
      { error: 'Unable to determine environment' },
      { status: 400 },
    );
  }

  let body: { peerPersonId?: unknown };
  try {
    body = (await request.json()) as { peerPersonId?: unknown };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const peerPersonId =
    typeof body.peerPersonId === 'number'
      ? body.peerPersonId
      : typeof body.peerPersonId === 'string'
      ? Number.parseInt(body.peerPersonId, 10)
      : NaN;
  if (!Number.isFinite(peerPersonId) || peerPersonId <= 0) {
    return NextResponse.json(
      { error: 'peerPersonId is required' },
      { status: 400 },
    );
  }
  if (peerPersonId === caller.id) {
    return NextResponse.json(
      { error: 'Cannot message yourself' },
      { status: 400 },
    );
  }

  const peer = await findPersonById({ id: peerPersonId }, { db });
  if (!peer || peer.networkVisible === false) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  }

  const links = await findMatrixUserIdsByPersonIds(
    { personIds: [caller.id, peer.id], environment },
    { db },
  );
  const callerMxid = links.find(
    (row) => row.personId === caller.id,
  )?.matrixUserId;
  const peerMxid = links.find((row) => row.personId === peer.id)?.matrixUserId;
  if (!callerMxid || !peerMxid) {
    return NextResponse.json(
      { error: 'Chat is not available for this person yet' },
      { status: 409 },
    );
  }

  const peerName =
    [peer.name, peer.surname].filter(Boolean).join(' ') ||
    peer.nickname ||
    peer.slug ||
    'Conversation';
  const created = await createBotOwnedRoomAction({
    title: peerName,
    grantPl100ToMatrixUserId: callerMxid,
    aliasLocalpart: networkDmAliasLocalpart(caller.id, peer.id),
  });
  if (!created?.roomId) {
    return NextResponse.json(
      { error: 'Could not open this conversation' },
      { status: 502 },
    );
  }

  await Promise.all([
    ensureMemberJoinedRoomAction({
      roomId: created.roomId,
      matrixUserId: callerMxid,
    }),
    ensureMemberJoinedRoomAction({
      roomId: created.roomId,
      matrixUserId: peerMxid,
    }),
  ]);

  return NextResponse.json({ roomId: created.roomId });
}
