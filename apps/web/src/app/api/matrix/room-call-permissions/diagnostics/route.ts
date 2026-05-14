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
  [k: string]: unknown;
};

const CALL_EVENT_TYPES = [
  'org.matrix.msc3401.call',
  'org.matrix.msc3401.call.member',
  'm.call.member',
] as const;

async function verifyPrivyToken(token: string): Promise<string | null> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID?.trim();
  const appSecret = process.env.PRIVY_APP_SECRET?.trim();
  if (!appId || !appSecret) return null;
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
  method: 'GET',
  url: string,
  accessToken: string,
): Promise<
  { ok: true; data: T } | { ok: false; status: number; body: string }
> {
  const response = await fetch(url, {
    method,
    headers: matrixHeaders(accessToken),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, status: response.status, body: text };
  }
  const data = (await response.json()) as T;
  return { ok: true, data };
}

async function resolveMatrixAccessToken(
  environment: ReturnType<typeof determineEnvironment>,
  privyUserId: string,
): Promise<string | null> {
  if (!environment) return null;
  const link = await getLinkByPrivyUserId({
    privyUserId,
    environment,
  });
  const encrypted = link?.encryptedAccessToken?.trim();
  if (!encrypted) return null;
  const decrypted = decryptMatrixToken(encrypted).trim();
  if (!decrypted) return null;
  const matrixAuthClient = new MatrixSharedSecret();
  const valid = await matrixAuthClient.validateToken(decrypted);
  return valid ? decrypted : null;
}

async function resolveAdminMatrixAccessToken(
  environment: ReturnType<typeof determineEnvironment>,
  authToken: string,
): Promise<string | null> {
  if (!environment) return null;
  const adminUsername =
    (await getAdminUserNameAction(
      { baseName: ADMIN_BASE_NAME, environment },
      { authToken },
    )) ?? null;
  if (!adminUsername) return null;
  return resolveMatrixAccessToken(environment, adminUsername);
}

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
  const callerAccessToken = await resolveMatrixAccessToken(
    environment,
    privyUserId,
  );
  const adminAccessToken = await resolveAdminMatrixAccessToken(
    environment,
    authToken,
  );

  const encodedRoomId = encodeURIComponent(roomId);
  let readerToken = callerAccessToken ?? adminAccessToken;
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
  if (!powerLevelsResult.ok && callerAccessToken && adminAccessToken) {
    readerToken =
      readerToken === callerAccessToken ? adminAccessToken : callerAccessToken;
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
