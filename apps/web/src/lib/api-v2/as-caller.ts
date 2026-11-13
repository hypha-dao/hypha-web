import {
  guardResource,
  type AuthServerConfig,
  type AuthServerDisabled,
} from '@hypha-platform/auth-server/server';

/**
 * #2608 SPIKE (separate commit from the authorization server itself): lets an `/api/v2` read
 * take the person from an access token issued by our own authorization server, in place of a
 * Privy token. The client key (`x-hypha-client-key`) is still required by `authenticateV2`:
 * this only replaces how the *person* is identified. How the token's client id relates to the
 * #2515 client registry is NOT decided (client-registration task).
 *
 * Opt-in: v2 accepts these tokens only when `<origin>/api/v2` is listed in
 * AUTH_SERVER_RESOURCES, and the token must have been issued for exactly that resource.
 */
export const V2_AS_SCOPE = 'spaces:read';

export type AuthServerCallerResult =
  | { kind: 'not-as-token' }
  | { kind: 'failure'; status: 401 | 403; error: string }
  | { kind: 'ok'; sub: string; clientId: string; scopes: string[] };

/** Issuer claim of a JWT without verifying it: only used to route to the right verifier. */
function peekIssuer(token: string): string | undefined {
  try {
    const payload = token.split('.')[1];
    if (!payload) return undefined;
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof claims.iss === 'string' ? claims.iss : undefined;
  } catch {
    return undefined;
  }
}

/**
 * #2608 / #2515 mapping (v2 side): the token's `client_id` must equal the slug of the registry
 * client that owns the client key sent with the request. The key says which app is calling; the
 * token says which app the person approved. If they differ, a token granted to one app is being
 * used by another (or with another app's key), so the call is refused rather than logged.
 * CIMD clients (URL client ids) can never match a slug: they carry no client key, so v2 is not
 * for them.
 */
export function tokenMatchesRegistryClient(
  tokenClientId: string,
  registrySlug: string,
): boolean {
  return tokenClientId === registrySlug;
}

export async function resolveAuthServerToken(
  request: Request,
  config: AuthServerConfig | AuthServerDisabled,
  keys?: Parameters<typeof guardResource>[2]['keys'],
  /** Scope the token must carry; v2 reads use `spaces:read`. */
  scope: string = V2_AS_SCOPE,
): Promise<AuthServerCallerResult> {
  const token = /^Bearer\s+(\S+)$/i.exec(
    request.headers.get('authorization') ?? '',
  )?.[1];
  if (!token || !config.enabled || peekIssuer(token) !== config.issuer) {
    return { kind: 'not-as-token' };
  }
  // The one audience `<origin>/api/v2` identifies the whole integrator surface of this server
  // (v2 reads and `/api/integration/v1`): one token, one consent, scopes tell the routes apart.
  // From here the token claims to be ours: it is never handed to the Privy path.
  const audience = config.resources.find((r) => r.endsWith('/api/v2'));
  if (!audience) {
    return { kind: 'failure', status: 401, error: 'invalid_token' };
  }
  const guard = await guardResource(request, config, {
    audience,
    scope,
    keys,
  });
  if (!guard.ok) {
    const body = (await guard.response
      .clone()
      .json()
      .catch(() => ({}))) as { error?: string };
    return {
      kind: 'failure',
      status: guard.response.status === 403 ? 403 : 401,
      error: body.error ?? 'invalid_token',
    };
  }
  const { sub, clientId, scopes } = guard.caller;
  return { kind: 'ok', sub, clientId, scopes };
}
