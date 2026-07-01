import 'server-only';

import { resolveUserMatrixAccessTokenForOrgMemory } from '../../governance/server/resolve-user-matrix-access-token-for-org-memory';

export function getMatrixHomeserverUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/?$/, '');
}

/** User session Matrix token for sending chat as the member (not the org-memory bot). */
export async function resolveUserMatrixAccessTokenForSend(
  authToken?: string,
  requestUrlForSessionMatrix?: string,
): Promise<string | null> {
  const sessionAuth = authToken?.trim();
  const sessionReqUrl = requestUrlForSessionMatrix?.trim();
  if (!sessionAuth || !sessionReqUrl) return null;
  return resolveUserMatrixAccessTokenForOrgMemory(sessionAuth, sessionReqUrl);
}

async function readMatrixJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      text.trim().slice(0, 240) ||
        `Matrix request failed with status ${res.status}`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Matrix returned a non-JSON response');
  }
}

export async function matrixJoinRoom(
  roomIdOrAlias: string,
  accessToken: string,
  homeserver: string,
): Promise<string> {
  const res = await fetch(
    `${homeserver}/_matrix/client/v3/join/${encodeURIComponent(roomIdOrAlias)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  const data = await readMatrixJson<{ room_id?: string }>(res);
  return data.room_id?.trim() || roomIdOrAlias.trim();
}

export async function matrixCreateRoom(
  name: string,
  accessToken: string,
  homeserver: string,
): Promise<string> {
  const res = await fetch(`${homeserver}/_matrix/client/v3/createRoom`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: name.trim().slice(0, 120) || 'Conversation',
      preset: 'private_chat',
      visibility: 'private',
    }),
  });
  const data = await readMatrixJson<{ room_id?: string }>(res);
  const roomId = data.room_id?.trim();
  if (!roomId) {
    throw new Error('Matrix createRoom returned no room_id');
  }
  return roomId;
}

export async function matrixSendTextMessage(
  roomId: string,
  message: string,
  accessToken: string,
  homeserver: string,
): Promise<string> {
  const txnId = `hypha.${Date.now()}.${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const res = await fetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/send/m.room.message/${encodeURIComponent(txnId)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        msgtype: 'm.text',
        body: message,
      }),
    },
  );
  const data = await readMatrixJson<{ event_id?: string }>(res);
  const eventId = data.event_id?.trim();
  if (!eventId) {
    throw new Error('Matrix send returned no event_id');
  }
  return eventId;
}
