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
} from '../_lib';

function buildManualPatch(powerLevels: MatrixPowerLevels): MatrixPowerLevels {
  const events = { ...(powerLevels.events ?? {}) };
  for (const eventType of CALL_EVENT_TYPES) {
    events[eventType] = 0;
  }
  return {
    ...powerLevels,
    events,
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
  const callerAccess = await resolveMatrixAccessToken(environment, privyUserId);
  const adminAccess = await resolveAdminMatrixAccessToken(
    environment,
    authToken,
  );

  const encodedRoomId = encodeURIComponent(roomId);
  let readerToken = callerAccess?.accessToken ?? adminAccess?.accessToken;
  if (!readerToken) {
    return NextResponse.json(
      {
        error: 'No valid Matrix access token available for diagnostics',
      },
      { status: 503 },
    );
  }

  let powerLevelsResult = await matrixRequest<MatrixPowerLevels>(
    'GET',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
    readerToken,
  );
  if (!powerLevelsResult.ok && callerAccess && adminAccess) {
    readerToken =
      readerToken === callerAccess.accessToken
        ? adminAccess.accessToken
        : callerAccess.accessToken;
    powerLevelsResult = await matrixRequest<MatrixPowerLevels>(
      'GET',
      `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
      readerToken,
    );
  }

  if (!powerLevelsResult.ok) {
    return NextResponse.json(
      {
        error: 'Failed to read room power levels for diagnostics',
        details: `${powerLevelsResult.status} ${powerLevelsResult.body}`,
      },
      { status: 502 },
    );
  }

  const powerLevels = powerLevelsResult.data;
  const users = Object.entries(powerLevels.users ?? {});
  const usersAtOrAbove100 = users
    .filter(([, level]) => level >= 100)
    .sort((a, b) => b[1] - a[1])
    .map(([userId, level]) => ({ userId, level }));

  const eventLevels = powerLevels.events ?? {};
  const requiredCallEventLevels = Object.fromEntries(
    CALL_EVENT_TYPES.map((eventType) => [
      eventType,
      eventLevels[eventType] ?? powerLevels.events_default ?? 0,
    ]),
  );
  const requiredToEditPowerLevels =
    eventLevels['m.room.power_levels'] ?? powerLevels.state_default ?? 50;

  const manualPatchContent = buildManualPatch(powerLevels);
  const matrixStatePutPath = `/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`;

  return NextResponse.json({
    ok: true,
    roomId,
    summary: {
      requiredToEditPowerLevels,
      requiredCallEventLevels,
      usersDefaultLevel: powerLevels.users_default ?? 0,
      usersAtOrAbove100,
    },
    manualPatch: {
      type: 'm.room.power_levels',
      stateKey: '',
      content: manualPatchContent,
    },
    matrixStatePutPath,
  });
}
