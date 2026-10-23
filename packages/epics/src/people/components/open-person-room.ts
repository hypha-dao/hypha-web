import { ClientEvent, SyncState, type MatrixClient } from 'matrix-js-sdk';
import {
  findJoinedDirectRoomId,
  waitUntil,
} from '../../../../core/src/matrix/open-direct-room';

import {
  readRememberedDirectRoom,
  rememberDirectRoom,
} from './member-connections';

export type OpenPersonRoomError =
  | 'not-connected'
  | 'no-matrix-id'
  | 'open-failed';

export class OpenPersonRoomFailure extends Error {
  constructor(readonly code: OpenPersonRoomError) {
    super(code);
  }
}

type MatrixHandle = {
  client: MatrixClient | null;
  isAuthenticated: boolean;
  ensureDirectRoom: (
    otherUserId: string,
    title: string,
  ) => Promise<{ roomId: string }>;
};

function otherUserIds(client: MatrixClient, roomId: string, selfId: string) {
  const room = client.getRoom(roomId);
  if (!room) return [];
  return room
    .getMembers()
    .filter(
      (member) =>
        (member.membership === 'join' || member.membership === 'invite') &&
        member.userId &&
        member.userId !== selfId,
    )
    .map((member) => member.userId);
}

export async function waitForMatrixHandle(
  getCurrent: () => MatrixHandle,
): Promise<MatrixHandle> {
  await waitUntil(
    () => {
      const current = getCurrent();
      return Boolean(current.isAuthenticated && current.client);
    },
    80,
    100,
  );
  const ready = getCurrent();
  if (!ready.client || !ready.isAuthenticated) {
    throw new OpenPersonRoomFailure('not-connected');
  }
  const client = ready.client;
  const state = client.getSyncState();
  if (state !== SyncState.Prepared && state !== SyncState.Syncing) {
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(finish, 8000);
      const onSync = (next: SyncState | null) => {
        if (next === SyncState.Prepared || next === SyncState.Syncing) {
          finish();
        }
      };
      function finish() {
        window.clearTimeout(timer);
        client.removeListener(ClientEvent.Sync, onSync);
        resolve();
      }
      client.on(ClientEvent.Sync, onSync);
    });
  }
  return getCurrent();
}

export async function openOrEnsurePersonRoom(options: {
  getMatrix: () => MatrixHandle;
  personId: number;
  title: string;
  waitForMatrixUserId: (personId: number) => Promise<string | null>;
}): Promise<string> {
  const ready = await waitForMatrixHandle(options.getMatrix);
  const client = ready.client;
  const selfId = client?.getUserId()?.trim() ?? '';
  if (!client || !selfId) {
    throw new OpenPersonRoomFailure('not-connected');
  }
  const mxid = (await options.waitForMatrixUserId(options.personId))?.trim();
  if (!mxid) {
    throw new OpenPersonRoomFailure('no-matrix-id');
  }
  const remembered = readRememberedDirectRoom(selfId, mxid);
  if (remembered && client.getRoom(remembered)?.getMyMembership() === 'join') {
    return remembered;
  }
  const existing = findJoinedDirectRoomId(
    client.getRooms().map((room) => ({
      roomId: room.roomId,
      membership: room.getMyMembership(),
      type: room.getType() ?? null,
      otherUserIds: otherUserIds(client, room.roomId, selfId),
    })),
    mxid,
  );
  if (existing) {
    rememberDirectRoom(selfId, mxid, existing);
    return existing;
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { roomId } = await ready.ensureDirectRoom(mxid, options.title);
      rememberDirectRoom(selfId, mxid, roomId);
      return roomId;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new OpenPersonRoomFailure('open-failed');
}

export function noticeKeyForOpenPersonRoomError(
  error: unknown,
): 'matrixUnavailable' | 'matrixPersonUnavailable' | 'matrixFailed' {
  if (error instanceof OpenPersonRoomFailure) {
    if (error.code === 'not-connected') return 'matrixUnavailable';
    if (error.code === 'no-matrix-id') return 'matrixPersonUnavailable';
  }
  return 'matrixFailed';
}
