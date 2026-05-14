import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getEnableHumanChat } from '@hypha-platform/feature-flags';
import { db } from '@hypha-platform/storage-postgres';
import {
  checkSpaceAccessForSpace,
  determineEnvironment,
  findSpaceHostFieldsBySlug,
} from '@hypha-platform/core/server';
import {
  CALL_EVENT_TYPES,
  matrixRequest,
  type MatrixPowerLevels,
  resolveAdminMatrixAccessToken,
  resolveMatrixAccessToken,
  verifyPrivyToken,
} from './_lib';

type SynapseAdminRoomStateResponse = {
  state?: Array<{
    type?: string;
    state_key?: string;
    content?: Record<string, unknown>;
  }>;
};

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

function createFailureResponse(
  correlationId: string,
  error: string,
  status: number,
  details: Record<string, unknown>,
) {
  console.warn('[room-call-permissions] request failed', {
    correlationId,
    error,
    details,
  });
  return NextResponse.json({ error, correlationId }, { status });
}

function requiredPowerLevelToEditPowerLevels(
  powerLevels: MatrixPowerLevels,
): number {
  const events = powerLevels.events ?? {};
  const fromEvents = events['m.room.power_levels'];
  if (typeof fromEvents === 'number') return fromEvents;
  if (typeof powerLevels.state_default === 'number') {
    return powerLevels.state_default;
  }
  return 50;
}

function effectiveUserPowerLevel(
  powerLevels: MatrixPowerLevels,
  userId: string,
): number {
  const users = powerLevels.users ?? {};
  const explicit = users[userId];
  if (typeof explicit === 'number') return explicit;
  if (typeof powerLevels.users_default === 'number') {
    return powerLevels.users_default;
  }
  return 0;
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get('x-correlation-id')?.trim() || randomUUID();
  const humanChatEnabled = await getEnableHumanChat();
  const authHeader = request.headers.get('Authorization');
  if (!humanChatEnabled || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized', correlationId },
      { status: 401 },
    );
  }
  const authToken = authHeader.slice('Bearer '.length).trim();
  const privyUserId = await verifyPrivyToken(authToken);
  if (!privyUserId) {
    return NextResponse.json(
      { error: 'Unauthorized', correlationId },
      { status: 401 },
    );
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
  const callerAccess = await resolveMatrixAccessToken(environment, privyUserId);
  if (!callerAccess) {
    return NextResponse.json(
      { error: 'Only space admins can repair room call permissions' },
      { status: 403 },
    );
  }
  const callerMatrixUserId = callerAccess.userId.trim();
  if (!callerMatrixUserId) {
    return NextResponse.json(
      { error: 'Only space admins can repair room call permissions' },
      { status: 403 },
    );
  }
  const encodedRoomId = encodeURIComponent(roomId);
  const callerPowerLevelsResult = await matrixRequest<MatrixPowerLevels>(
    'GET',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
    callerAccess.accessToken,
  );
  if (!callerPowerLevelsResult.ok) {
    return NextResponse.json(
      { error: 'Only space admins can repair room call permissions' },
      { status: 403 },
    );
  }
  const callerRequired = requiredPowerLevelToEditPowerLevels(
    callerPowerLevelsResult.data,
  );
  const callerLevel = effectiveUserPowerLevel(
    callerPowerLevelsResult.data,
    callerMatrixUserId,
  );
  if (callerLevel < callerRequired) {
    return NextResponse.json(
      { error: 'Only space admins can repair room call permissions' },
      { status: 403 },
    );
  }
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
    if (callerAccess.accessToken) {
      const inviteAttempt = await matrixRequest<Record<string, unknown>>(
        'POST',
        `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/invite`,
        callerAccess.accessToken,
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
    return createFailureResponse(
      correlationId,
      'Failed to join room as admin before permission repair',
      502,
      {
        joinResult: { status: joinResult.status, body: joinResult.body },
      },
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
      return createFailureResponse(
        correlationId,
        'Failed to read room power levels',
        502,
        {
          joinAttemptDetails,
          matrixClient: powerLevelsResult.body,
          synapseAdmin: fallbackRead.details,
        },
      );
    }
  }

  if (!current) {
    return createFailureResponse(
      correlationId,
      'Failed to read room power levels',
      502,
      { reason: 'Power levels not available' },
    );
  }
  const applyCallEventLevels = (source: MatrixPowerLevels) => {
    const events = { ...(source.events ?? {}) };
    let changedAtSource = false;
    for (const eventType of CALL_EVENT_TYPES) {
      if (events[eventType] !== 0) {
        events[eventType] = 0;
        changedAtSource = true;
      }
    }
    return {
      changedAtSource,
      next: {
        ...source,
        events,
      } as MatrixPowerLevels,
    };
  };
  const fromCurrent = applyCallEventLevels(current);
  if (!fromCurrent.changedAtSource) {
    return NextResponse.json({ ok: true, changed: false });
  }

  let nextPowerLevels = fromCurrent.next;
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
      const refreshedPowerLevels = await matrixRequest<MatrixPowerLevels>(
        'GET',
        `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
        adminAccessToken,
      );
      if (refreshedPowerLevels.ok) {
        nextPowerLevels = applyCallEventLevels(refreshedPowerLevels.data).next;
      }
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
      correlationId,
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
    if (callerAccess.accessToken) {
      const callerWrite = await writePowerLevelsWithClientApi(
        homeserver,
        roomId,
        callerAccess.accessToken,
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
          correlationId,
        });
      }
    } else {
      callerWriteAttempt = {
        ok: false,
        details: 'caller-matrix-token-unavailable',
      };
    }

    return createFailureResponse(
      correlationId,
      'Failed to update room power levels for call events',
      502,
      {
        joinAttemptDetails,
        makeRoomAdminAttempt: makeRoomAdminAttemptDetails,
        callerWriteAttempt,
        matrixClient: updateResult.body,
        synapseAdmin: fallbackWrite.details,
      },
    );
  }

  return NextResponse.json({
    ok: true,
    changed: true,
    roomId,
    correlationId,
  });
}
