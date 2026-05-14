import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/node';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';
import { db } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  decryptMatrixToken,
  determineEnvironment,
  findSpaceHostFieldsBySlug,
  getAdminUserNameAction,
  getLinkByPrivyUserId,
  MatrixSharedSecret,
} from '@hypha-platform/core/server';

const ADMIN_BASE_NAME = 'hypha_admin';

type MatrixPowerLevels = {
  users?: Record<string, number>;
  users_default?: number;
  events?: Record<string, number>;
  events_default?: number;
  state_default?: number;
  ban?: number;
  kick?: number;
  redact?: number;
  invite?: number;
  notifications?: Record<string, unknown>;
  [k: string]: unknown;
};

type SynapseAdminRoomStateResponse = {
  state?: Array<{
    type?: string;
    state_key?: string;
    content?: Record<string, unknown>;
  }>;
};

const CALL_EVENT_TYPES = [
  'org.matrix.msc3401.call',
  'org.matrix.msc3401.call.member',
  'm.call.member',
] as const;

async function verifyPrivyToken(token: string): Promise<string | null> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    return null;
  }
  try {
    const privy = new PrivyClient({ appId, appSecret });
    const { user_id } = await privy.utils().auth().verifyAuthToken(token);
    return user_id;
  } catch {
    return null;
  }
}

function matrixHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function matrixRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  accessToken: string,
  body?: unknown,
): Promise<
  { ok: true; data: T } | { ok: false; status: number; body: string }
> {
  const response = await fetch(url, {
    method,
    headers: matrixHeaders(accessToken),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, status: response.status, body: text };
  }
  const data = (await response.json()) as T;
  return { ok: true, data };
}

async function resolveAdminMatrixAccessToken(
  environment: ReturnType<typeof determineEnvironment>,
  authToken: string,
): Promise<{ accessToken: string; userId: string } | null> {
  if (!environment) return null;
  const adminUsername =
    (await getAdminUserNameAction(
      { baseName: ADMIN_BASE_NAME, environment },
      { authToken },
    )) ?? null;
  if (!adminUsername) return null;
  const admin = await getLinkByPrivyUserId({
    privyUserId: adminUsername,
    environment,
  });
  const encrypted = admin?.encryptedAccessToken?.trim();
  if (!encrypted) return null;
  const decrypted = decryptMatrixToken(encrypted).trim();
  if (!decrypted) return null;
  const adminUserId = admin?.matrixUserId?.trim();
  if (!adminUserId) return null;
  const matrixAuthClient = new MatrixSharedSecret();
  const valid = await matrixAuthClient.validateToken(decrypted);
  return valid ? { accessToken: decrypted, userId: adminUserId } : null;
}

async function readPowerLevelsViaSynapseAdminApi(
  homeserver: string,
  roomId: string,
  accessToken: string,
): Promise<
  { ok: true; powerLevels: MatrixPowerLevels } | { ok: false; details: string }
> {
  const encodedRoomId = encodeURIComponent(roomId);
  const result = await matrixRequest<SynapseAdminRoomStateResponse>(
    'GET',
    `${homeserver}/_synapse/admin/v1/rooms/${encodedRoomId}/state`,
    accessToken,
  );
  if (!result.ok) {
    return {
      ok: false,
      details: `synapse-admin-read-failed: ${result.status} ${result.body}`,
    };
  }
  const events = result.data.state ?? [];
  for (const event of events) {
    if (
      event.type === 'm.room.power_levels' &&
      (event.state_key ?? '') === ''
    ) {
      const content = event.content ?? {};
      return {
        ok: true,
        powerLevels: content as MatrixPowerLevels,
      };
    }
  }
  return {
    ok: false,
    details: 'synapse-admin-read-failed: m.room.power_levels not found',
  };
}

async function writePowerLevelsViaSynapseAdminApi(
  homeserver: string,
  roomId: string,
  accessToken: string,
  content: MatrixPowerLevels,
): Promise<{ ok: true } | { ok: false; details: string }> {
  const encodedRoomId = encodeURIComponent(roomId);
  const attempts = [
    `${homeserver}/_synapse/admin/v2/rooms/${encodedRoomId}/state/m.room.power_levels`,
    `${homeserver}/_synapse/admin/v1/rooms/${encodedRoomId}/state/m.room.power_levels`,
    `${homeserver}/_synapse/admin/v2/rooms/${encodedRoomId}/state/m.room.power_levels/`,
    `${homeserver}/_synapse/admin/v1/rooms/${encodedRoomId}/state/m.room.power_levels/`,
  ] as const;
  let lastFailure = 'unknown';
  for (const url of attempts) {
    const result = await matrixRequest<Record<string, unknown>>(
      'PUT',
      url,
      accessToken,
      content,
    );
    if (result.ok) {
      return { ok: true };
    }
    lastFailure = `${result.status} ${result.body}`;
  }
  return {
    ok: false,
    details: `synapse-admin-write-failed: ${lastFailure}`,
  };
}

async function forceJoinUserViaSynapseAdminApi(
  homeserver: string,
  roomId: string,
  userId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; details: string }> {
  const encodedRoomId = encodeURIComponent(roomId);
  const attempts = [
    `${homeserver}/_synapse/admin/v1/join/${encodedRoomId}`,
    `${homeserver}/_synapse/admin/v1/join/${roomId}`,
  ] as const;

  let lastFailure = 'unknown';
  for (const url of attempts) {
    const result = await matrixRequest<Record<string, unknown>>(
      'POST',
      url,
      accessToken,
      { user_id: userId },
    );
    if (result.ok) {
      return { ok: true };
    }
    lastFailure = `${result.status} ${result.body}`;
  }

  return {
    ok: false,
    details: `synapse-admin-force-join-failed: ${lastFailure}`,
  };
}

async function makeRoomAdminViaSynapseAdminApi(
  homeserver: string,
  roomId: string,
  userId: string,
  accessToken: string,
): Promise<{ ok: true } | { ok: false; details: string }> {
  const encodedRoomId = encodeURIComponent(roomId);
  const attempts = [
    `${homeserver}/_synapse/admin/v1/rooms/${encodedRoomId}/make_room_admin`,
    `${homeserver}/_synapse/admin/v1/rooms/${roomId}/make_room_admin`,
  ] as const;

  let lastFailure = 'unknown';
  for (const url of attempts) {
    const result = await matrixRequest<Record<string, unknown>>(
      'POST',
      url,
      accessToken,
      { user_id: userId },
    );
    if (result.ok) {
      return { ok: true };
    }
    lastFailure = `${result.status} ${result.body}`;
  }

  return {
    ok: false,
    details: `synapse-admin-make-room-admin-failed: ${lastFailure}`,
  };
}

async function resolveCallerMatrixAccessToken(
  environment: ReturnType<typeof determineEnvironment>,
  privyUserId: string,
): Promise<string | null> {
  if (!environment) return null;
  const userLink = await getLinkByPrivyUserId({
    privyUserId,
    environment,
  });
  const encrypted = userLink?.encryptedAccessToken?.trim();
  if (!encrypted) return null;
  const decrypted = decryptMatrixToken(encrypted).trim();
  if (!decrypted) return null;
  const matrixAuthClient = new MatrixSharedSecret();
  const valid = await matrixAuthClient.validateToken(decrypted);
  return valid ? decrypted : null;
}

async function writePowerLevelsWithClientApi(
  homeserver: string,
  roomId: string,
  accessToken: string,
  content: MatrixPowerLevels,
): Promise<{ ok: true } | { ok: false; details: string }> {
  const encodedRoomId = encodeURIComponent(roomId);
  const result = await matrixRequest<Record<string, unknown>>(
    'PUT',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
    accessToken,
    content,
  );
  if (result.ok) return { ok: true };
  return {
    ok: false,
    details: `matrix-client-write-failed: ${result.status} ${result.body}`,
  };
}

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
    roomId?: string;
    spaceSlug?: string;
  } | null;
  const roomId = body?.roomId?.trim();
  const spaceSlug = body?.spaceSlug?.trim();
  if (!roomId || !spaceSlug) {
    return NextResponse.json(
      { error: 'roomId and spaceSlug are required' },
      { status: 400 },
    );
  }

  const space = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  if (
    !space ||
    !space.chatRoomId?.trim() ||
    space.chatRoomId.trim() !== roomId
  ) {
    return NextResponse.json({ error: 'Space/room mismatch' }, { status: 404 });
  }

  const access = await checkSpaceAccessForSpace(space, authToken);
  if (!access.hasAccess) {
    return NextResponse.json({ error: access.message }, { status: 403 });
  }

  const homeserver = process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL?.replace(
    /\/?$/,
    '',
  );
  if (!homeserver) {
    return NextResponse.json(
      { error: 'Matrix homeserver not configured' },
      { status: 500 },
    );
  }

  const environment = determineEnvironment(request.url);
  const callerMatrixAccessToken = await resolveCallerMatrixAccessToken(
    environment,
    privyUserId,
  );
  const adminCredentials = await resolveAdminMatrixAccessToken(
    environment,
    authToken,
  );
  if (!adminCredentials) {
    return NextResponse.json(
      { error: 'No valid Matrix admin access token found' },
      { status: 503 },
    );
  }

  const encodedRoomId = encodeURIComponent(roomId);
  const adminAccessToken = adminCredentials.accessToken;
  const joinResult = await matrixRequest<Record<string, unknown>>(
    'POST',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/join`,
    adminAccessToken,
    {},
  );
  let joinAttemptDetails: Record<string, unknown> | undefined;
  let joinedAsAdmin = joinResult.ok;
  if (!joinResult.ok && joinResult.status === 403) {
    if (callerMatrixAccessToken) {
      const inviteAttempt = await matrixRequest<Record<string, unknown>>(
        'POST',
        `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/invite`,
        callerMatrixAccessToken,
        {
          user_id: adminCredentials.userId,
        },
      );
      const rejoinAttempt = await matrixRequest<Record<string, unknown>>(
        'POST',
        `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/join`,
        adminAccessToken,
        {},
      );
      joinAttemptDetails = {
        initialJoin: { status: joinResult.status, body: joinResult.body },
        inviteAttempt: inviteAttempt.ok
          ? { ok: true }
          : {
              ok: false,
              status: inviteAttempt.status,
              body: inviteAttempt.body,
            },
        rejoinAttempt: rejoinAttempt.ok
          ? { ok: true }
          : {
              ok: false,
              status: rejoinAttempt.status,
              body: rejoinAttempt.body,
            },
      };
      joinedAsAdmin = rejoinAttempt.ok;
    } else {
      joinAttemptDetails = {
        initialJoin: { status: joinResult.status, body: joinResult.body },
        inviteAttempt: { ok: false, reason: 'caller-matrix-token-unavailable' },
      };
    }

    if (!joinedAsAdmin) {
      const forceJoinAttempt = await forceJoinUserViaSynapseAdminApi(
        homeserver,
        roomId,
        adminCredentials.userId,
        adminAccessToken,
      );
      joinAttemptDetails = {
        ...(joinAttemptDetails ?? {
          initialJoin: { status: joinResult.status, body: joinResult.body },
        }),
        forceJoinAttempt: forceJoinAttempt.ok
          ? { ok: true }
          : { ok: false, details: forceJoinAttempt.details },
      };
      joinedAsAdmin = forceJoinAttempt.ok;
    }
  } else if (!joinResult.ok && joinResult.status !== 403) {
    return NextResponse.json(
      {
        error: 'Failed to join room as admin before permission repair',
        details: {
          joinResult: { status: joinResult.status, body: joinResult.body },
        },
      },
      { status: 502 },
    );
  }

  let current: MatrixPowerLevels | null = null;
  const powerLevelsResult = await matrixRequest<MatrixPowerLevels>(
    'GET',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
    adminAccessToken,
  );
  if (powerLevelsResult.ok) {
    current = powerLevelsResult.data;
  } else {
    const fallbackRead = await readPowerLevelsViaSynapseAdminApi(
      homeserver,
      roomId,
      adminAccessToken,
    );
    if (fallbackRead.ok) {
      current = fallbackRead.powerLevels;
    } else {
      return NextResponse.json(
        {
          error: 'Failed to read room power levels',
          details: {
            joinAttemptDetails,
            matrixClient: powerLevelsResult.body,
            synapseAdmin: fallbackRead.details,
          },
        },
        { status: 502 },
      );
    }
  }

  if (!current) {
    return NextResponse.json(
      {
        error: 'Failed to read room power levels',
        details: 'Power levels not available',
      },
      { status: 502 },
    );
  }
  const currentEvents = { ...(current.events ?? {}) };
  let changed = false;
  for (const eventType of CALL_EVENT_TYPES) {
    if (currentEvents[eventType] !== 0) {
      currentEvents[eventType] = 0;
      changed = true;
    }
  }

  if (!changed) {
    return NextResponse.json({ ok: true, changed: false });
  }

  const nextPowerLevels: MatrixPowerLevels = {
    ...current,
    events: currentEvents,
  };
  let updateResult = await matrixRequest<Record<string, unknown>>(
    'PUT',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
    adminAccessToken,
    nextPowerLevels,
  );
  let makeRoomAdminAttemptDetails:
    | { ok: true }
    | { ok: false; details: string }
    | undefined;
  if (!updateResult.ok && updateResult.status === 403) {
    const makeRoomAdminAttempt = await makeRoomAdminViaSynapseAdminApi(
      homeserver,
      roomId,
      adminCredentials.userId,
      adminAccessToken,
    );
    makeRoomAdminAttemptDetails = makeRoomAdminAttempt.ok
      ? { ok: true }
      : { ok: false, details: makeRoomAdminAttempt.details };

    if (makeRoomAdminAttempt.ok) {
      updateResult = await matrixRequest<Record<string, unknown>>(
        'PUT',
        `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
        adminAccessToken,
        nextPowerLevels,
      );
    }
  }
  if (updateResult.ok) {
    return NextResponse.json({
      ok: true,
      changed: true,
      roomId,
      correlationId: request.headers.get('x-correlation-id') ?? randomUUID(),
    });
  }

  const fallbackWrite = await writePowerLevelsViaSynapseAdminApi(
    homeserver,
    roomId,
    adminAccessToken,
    nextPowerLevels,
  );
  if (!fallbackWrite.ok) {
    let callerWriteAttempt:
      | { ok: true }
      | { ok: false; details: string }
      | undefined;
    if (callerMatrixAccessToken) {
      const callerWrite = await writePowerLevelsWithClientApi(
        homeserver,
        roomId,
        callerMatrixAccessToken,
        nextPowerLevels,
      );
      callerWriteAttempt = callerWrite.ok
        ? { ok: true }
        : { ok: false, details: callerWrite.details };
      if (callerWrite.ok) {
        return NextResponse.json({
          ok: true,
          changed: true,
          roomId,
          correlationId:
            request.headers.get('x-correlation-id') ?? randomUUID(),
        });
      }
    } else {
      callerWriteAttempt = {
        ok: false,
        details: 'caller-matrix-token-unavailable',
      };
    }

    return NextResponse.json(
      {
        error: 'Failed to update room power levels for call events',
        details: {
          joinAttemptDetails,
          makeRoomAdminAttempt: makeRoomAdminAttemptDetails,
          callerWriteAttempt,
          matrixClient: updateResult.body,
          synapseAdmin: fallbackWrite.details,
        },
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    changed: true,
    roomId,
    correlationId: request.headers.get('x-correlation-id') ?? randomUUID(),
  });
}
