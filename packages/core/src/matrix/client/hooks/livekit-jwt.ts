import type * as MatrixSdk from 'matrix-js-sdk';

export type LiveKitConnectCredentials = {
  url: string;
  jwt: string;
};

type MatrixClientWellKnown = {
  'org.matrix.msc4143.rtc_foci'?: Array<{
    type?: string;
    livekit_service_url?: string;
  }>;
};

const WELL_KNOWN_FETCH_TIMEOUT_MS = 5_000;

/** Keyed by homeserver URL so switching homeservers can't reuse a stale resolution. */
const cachedJwtServiceUrlByHomeserver = new Map<string, string>();

/**
 * The Matrix OpenID token is sent to this URL, so require https: — except for
 * loopback hosts, where http: is the documented local-dev fallback (see
 * `.env.template`).
 */
function isAllowedJwtServiceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:') return true;
    return (
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

function livekitJwtServiceUrlFromEnv(): string | null {
  const raw = process.env.NEXT_PUBLIC_LIVEKIT_JWT_SERVICE_URL?.trim();
  if (!raw || !isAllowedJwtServiceUrl(raw)) return null;
  return raw;
}

function extractLivekitFocusUrl(data: MatrixClientWellKnown): string | null {
  const foci = data['org.matrix.msc4143.rtc_foci'];
  const livekitFocus = foci?.find(
    (f) => f.type === 'livekit' && f.livekit_service_url?.trim(),
  );
  const url = livekitFocus?.livekit_service_url?.trim();
  if (!url || !isAllowedJwtServiceUrl(url)) return null;
  return url;
}

async function tryFetchWellKnown(
  url: string,
  homeserverUrl: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(WELL_KNOWN_FETCH_TIMEOUT_MS),
    });
    if (res.ok) {
      const data = (await res.json()) as MatrixClientWellKnown;
      const focusUrl = extractLivekitFocusUrl(data);
      if (focusUrl) {
        cachedJwtServiceUrlByHomeserver.set(homeserverUrl, focusUrl);
        return focusUrl;
      }
    }
  } catch {
    // fall through
  }
  return null;
}

/**
 * Resolve the lk-jwt-service URL from Matrix .well-known or env fallback.
 */
export async function resolveLivekitJwtServiceUrl(
  client: MatrixSdk.MatrixClient,
): Promise<string> {
  const envUrl = livekitJwtServiceUrlFromEnv();
  if (envUrl) return envUrl;

  const homeserverUrl = client.getHomeserverUrl();
  const cached = cachedJwtServiceUrlByHomeserver.get(homeserverUrl);
  if (cached) return cached;

  const wellKnownUrl = new URL('/.well-known/matrix/client', homeserverUrl);
  const fromHomeserver = await tryFetchWellKnown(
    wellKnownUrl.toString(),
    homeserverUrl,
  );
  if (fromHomeserver) return fromHomeserver;

  if (typeof window !== 'undefined') {
    const fromSameOrigin = await tryFetchWellKnown(
      '/.well-known/matrix/client',
      homeserverUrl,
    );
    if (fromSameOrigin) return fromSameOrigin;
  }

  throw new Error(
    'LiveKit JWT service URL not configured. Set NEXT_PUBLIC_LIVEKIT_JWT_SERVICE_URL or org.matrix.msc4143.rtc_foci in .well-known/matrix/client.',
  );
}

/**
 * Exchange Matrix OpenID token for LiveKit room credentials via lk-jwt-service.
 */
export async function fetchLivekitConnectCredentials(
  client: MatrixSdk.MatrixClient,
  roomId: string,
  jwtServiceUrl: string,
): Promise<LiveKitConnectCredentials> {
  const openIdToken = await client.getOpenIdToken();
  const base = jwtServiceUrl.replace(/\/$/, '');
  const res = await fetch(`${base}/sfu/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room: roomId,
      openid_token: openIdToken,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `LiveKit JWT exchange failed (${res.status})${text ? `: ${text}` : ''}`,
    );
  }
  const data = (await res.json()) as { url?: string; jwt?: string };
  const url = data.url?.trim();
  const jwt = data.jwt?.trim();
  if (!url || !jwt) {
    throw new Error('LiveKit JWT service returned invalid credentials');
  }
  return { url, jwt };
}

export function clearLivekitJwtServiceUrlCache(): void {
  cachedJwtServiceUrlByHomeserver.clear();
}
