import 'server-only';

import {
  resolveUserMatrixAccessTokenForOrgMemory,
  resolveUserMatrixIdentityForOrgMemory,
} from '../../governance/server/resolve-user-matrix-access-token-for-org-memory';

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

/** Same as `resolveUserMatrixAccessTokenForSend`, but also returns the sender's own MXID
 * (needed to puppet-join them into invite-only rooms via the bot's AS token, #2428). */
export async function resolveUserMatrixIdentityForSend(
  authToken?: string,
  requestUrlForSessionMatrix?: string,
): Promise<{ accessToken: string; matrixUserId: string } | null> {
  const sessionAuth = authToken?.trim();
  const sessionReqUrl = requestUrlForSessionMatrix?.trim();
  if (!sessionAuth || !sessionReqUrl) return null;
  return resolveUserMatrixIdentityForOrgMemory(sessionAuth, sessionReqUrl);
}

const MATRIX_HTTP_TIMEOUT_MS = 10_000;

/** All Matrix HTTP calls in this file go through this — bounds worst-case latency when the
 * homeserver stalls, instead of hanging the request thread indefinitely (#2428 review). */
function matrixFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    signal: AbortSignal.timeout(MATRIX_HTTP_TIMEOUT_MS),
  });
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

/** Permanent Application Service credential for the org bot (never expires by login/logout). */
export function getMatrixBotAsToken(): string | null {
  const raw = process.env.HYPHA_MATRIX_BOT_AS_TOKEN?.trim();
  return raw || null;
}

/** Bot's Matrix user id (e.g. `@hypha_bot:matrix.test`) — public, not a secret. */
export function getMatrixBotUserId(): string | null {
  const raw = process.env.NEXT_PUBLIC_MATRIX_BOT_USER_ID?.trim();
  return raw || null;
}

export async function matrixInviteUser(
  roomId: string,
  userId: string,
  accessToken: string,
  homeserver: string,
): Promise<void> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/invite`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
    },
  );
  await readMatrixJson<Record<string, never>>(res);
}

export async function matrixJoinRoom(
  roomIdOrAlias: string,
  accessToken: string,
  homeserver: string,
): Promise<string> {
  const res = await matrixFetch(
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

/**
 * Join `roomId` as `puppetUserId` using the AS's own `as_token` — no login, no accept step
 * from that user. Only works for MXIDs matching the AS's registered namespace (#2428 Decision 9).
 */
export async function matrixJoinRoomAsPuppet(
  roomId: string,
  puppetUserId: string,
  asToken: string,
  homeserver: string,
): Promise<void> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/join/${encodeURIComponent(
      roomId,
    )}?user_id=${encodeURIComponent(puppetUserId)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${asToken}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  await readMatrixJson<{ room_id?: string }>(res);
}

export async function matrixGetPowerLevels(
  roomId: string,
  accessToken: string,
  homeserver: string,
): Promise<{
  users?: Record<string, number>;
  users_default?: number;
  events?: Record<string, number>;
  state_default?: number;
  [key: string]: unknown;
}> {
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/state/m.room.power_levels/`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return readMatrixJson(res);
}

const MATRIX_GROUP_CALL_EVENT_TYPE = 'org.matrix.msc3401.call';
const MATRIX_GROUP_CALL_MEMBER_EVENT_TYPE = 'org.matrix.msc3401.call.member';
const MATRIX_LEGACY_CALL_MEMBER_EVENT_TYPE = 'm.call.member';

/**
 * Single read-modify-write against `m.room.power_levels`: opens group-call state event types to
 * all members (PL0) and, if given, grants `grantPl100ToUserId` PL100 — in one GET/PUT cycle
 * instead of two sequential ones, so the second write can't silently drop a concurrent change
 * made to the same state event between them (#2428 review). Run by the bot right after room
 * creation, since the bot (not the human) is now the room creator holding PL to edit
 * power_levels.
 */
export async function matrixApplyRoomPowerLevels(
  roomId: string,
  accessToken: string,
  homeserver: string,
  options: { grantPl100ToUserId?: string } = {},
): Promise<void> {
  const current = await matrixGetPowerLevels(roomId, accessToken, homeserver);
  const events = {
    ...current.events,
    [MATRIX_GROUP_CALL_EVENT_TYPE]: 0,
    [MATRIX_GROUP_CALL_MEMBER_EVENT_TYPE]: 0,
    [MATRIX_LEGACY_CALL_MEMBER_EVENT_TYPE]: 0,
  };
  const targetUserId = options.grantPl100ToUserId?.trim();
  const users = targetUserId
    ? { ...current.users, [targetUserId]: 100 }
    : current.users;
  const res = await matrixFetch(
    `${homeserver}/_matrix/client/v3/rooms/${encodeURIComponent(
      roomId,
    )}/state/m.room.power_levels/`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...current, events, users }),
    },
  );
  await readMatrixJson<Record<string, never>>(res);
}

export async function matrixCreateRoom(
  name: string,
  accessToken: string,
  homeserver: string,
): Promise<string> {
  const res = await matrixFetch(`${homeserver}/_matrix/client/v3/createRoom`, {
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
  const res = await matrixFetch(
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
