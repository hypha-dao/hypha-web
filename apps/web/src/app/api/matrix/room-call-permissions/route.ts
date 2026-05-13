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
): Promise<string | null> {
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
  const matrixAuthClient = new MatrixSharedSecret();
  const valid = await matrixAuthClient.validateToken(decrypted);
  return valid ? decrypted : null;
}

export async function POST(request: NextRequest) {
  const humanChatEnabled = await getEnableHumanChat();
  const authHeader = request.headers.get('Authorization');
  if (!humanChatEnabled || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const authToken = authHeader.slice('Bearer '.length).trim();
  if (!(await verifyPrivyToken(authToken))) {
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
  const adminAccessToken = await resolveAdminMatrixAccessToken(
    environment,
    authToken,
  );
  if (!adminAccessToken) {
    return NextResponse.json(
      { error: 'No valid Matrix admin access token found' },
      { status: 503 },
    );
  }

  const encodedRoomId = encodeURIComponent(roomId);
  const joinResult = await matrixRequest<Record<string, unknown>>(
    'POST',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/join`,
    adminAccessToken,
    {},
  );
  if (!joinResult.ok && joinResult.status !== 403) {
    return NextResponse.json(
      {
        error: 'Failed to join room as admin before permission repair',
        details: joinResult.body,
      },
      { status: 502 },
    );
  }

  const powerLevelsResult = await matrixRequest<MatrixPowerLevels>(
    'GET',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
    adminAccessToken,
  );
  if (!powerLevelsResult.ok) {
    return NextResponse.json(
      {
        error: 'Failed to read room power levels',
        details: powerLevelsResult.body,
      },
      { status: 502 },
    );
  }

  const current = powerLevelsResult.data;
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

  const updateResult = await matrixRequest<Record<string, unknown>>(
    'PUT',
    `${homeserver}/_matrix/client/v3/rooms/${encodedRoomId}/state/m.room.power_levels`,
    adminAccessToken,
    {
      ...current,
      events: currentEvents,
    },
  );
  if (!updateResult.ok) {
    return NextResponse.json(
      {
        error: 'Failed to update room power levels for call events',
        details: updateResult.body,
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
