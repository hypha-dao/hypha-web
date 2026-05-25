import { PrivyClient } from '@privy-io/node';
import {
  decryptMatrixToken,
  determineEnvironment,
  getAdminUserNameAction,
  getLinkByPrivyUserId,
  MatrixSharedSecret,
} from '@hypha-platform/core/server';

export const ADMIN_BASE_NAME = 'hypha_admin';

export type MatrixPowerLevels = {
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
};

export const CALL_EVENT_TYPES = [
  'org.matrix.msc3401.call',
  'org.matrix.msc3401.call.member',
  'm.call.member',
] as const;

export async function verifyPrivyToken(token: string): Promise<string | null> {
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

export function matrixHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export async function matrixRequest<T>(
  method: 'GET' | 'POST' | 'PUT',
  url: string,
  accessToken: string,
  body?: unknown,
): Promise<
  { ok: true; data: T } | { ok: false; status: number; body: string }
> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: matrixHeaders(accessToken),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return {
      ok: false,
      status: 502,
      body: error instanceof Error ? error.message : String(error),
    };
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return { ok: false, status: response.status, body: text };
  }
  try {
    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function resolveMatrixAccessToken(
  environment: ReturnType<typeof determineEnvironment>,
  privyUserId: string,
): Promise<{ accessToken: string; userId: string } | null> {
  if (!environment) return null;
  const link = await getLinkByPrivyUserId({
    privyUserId,
    environment,
  });
  const encrypted = link?.encryptedAccessToken?.trim();
  if (!encrypted) return null;
  let decrypted: string;
  try {
    decrypted = decryptMatrixToken(encrypted).trim();
  } catch {
    return null;
  }
  if (!decrypted) return null;
  const userId = link?.matrixUserId?.trim();
  if (!userId) return null;
  const matrixAuthClient = new MatrixSharedSecret();
  const valid = await matrixAuthClient.validateToken(decrypted);
  return valid ? { accessToken: decrypted, userId } : null;
}

export async function resolveAdminMatrixAccessToken(
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
  return resolveMatrixAccessToken(environment, adminUsername);
}

function parseMxcMediaUri(mediaUri: string): {
  serverName: string;
  mediaId: string;
} | null {
  if (!mediaUri.startsWith('mxc://')) return null;
  const rest = mediaUri.slice('mxc://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash >= rest.length - 1) return null;
  const serverName = rest.slice(0, slash).trim();
  const mediaId = rest.slice(slash + 1).trim();
  if (!serverName || !mediaId) return null;
  return { serverName, mediaId };
}

/** Verify the caller can read an MXC URI they claim to have uploaded. */
export async function verifyMatrixMediaUriAccessible(params: {
  mediaUri: string;
  accessToken: string;
  homeserverUrl: string;
}): Promise<boolean> {
  const parsed = parseMxcMediaUri(params.mediaUri.trim());
  if (!parsed) return false;
  const base = params.homeserverUrl.replace(/\/$/, '');
  const url = `${base}/_matrix/media/v3/download/${encodeURIComponent(
    parsed.serverName,
  )}/${encodeURIComponent(parsed.mediaId)}`;
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        Range: 'bytes=0-0',
      },
      signal: AbortSignal.timeout(12_000),
    });
    return response.ok || response.status === 206;
  } catch {
    return false;
  }
}
