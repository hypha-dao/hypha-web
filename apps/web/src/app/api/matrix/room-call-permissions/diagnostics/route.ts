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
  if (!callerAccess) {
    return NextResponse.json(
      { error: 'Only space admins can access diagnostics' },
      { status: 403 },
    );
  }
  const callerMatrixUserId = callerAccess.userId.trim();
  if (!callerMatrixUserId) {
    return NextResponse.json(
      { error: 'Only space admins can access diagnostics' },
      { status: 403 },
    );
  }

  const encodedRoomId = encodeURIComponent(roomId);
  const powerLevelsResult = await matrixRequest<MatrixPowerLevels>(
    'GET',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
    callerAccess.accessToken,
  );
  if (!powerLevelsResult.ok) {
    const status =
      powerLevelsResult.status === 401 || powerLevelsResult.status === 403
        ? 403
        : 503;
    return NextResponse.json(
      {
        error: 'Failed to read room power levels for diagnostics',
        details: `${powerLevelsResult.status} ${powerLevelsResult.body}`,
      },
      { status },
    );
  }

  const powerLevels = powerLevelsResult.data;
  const requiredToEditPowerLevels =
    requiredPowerLevelToEditPowerLevels(powerLevels);
  const callerLevel = effectiveUserPowerLevel(powerLevels, callerMatrixUserId);
  if (callerLevel < requiredToEditPowerLevels) {
    return NextResponse.json(
      { error: 'Only space admins can access diagnostics' },
      { status: 403 },
    );
  }
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
