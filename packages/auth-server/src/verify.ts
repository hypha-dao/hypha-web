import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { AUTH_SERVER_API_BASE_PATH, loadAuthServerConfig } from './config';

export type VerifiedAccessToken = {
  /** Person id: the Privy user id (= people.sub). */
  sub: string;
  /** Client id (the Client ID Metadata Document URL for unregistered AI apps). */
  clientId: string;
  scopes: string[];
  aud: string[];
};

export type VerifyAccessTokenOptions = {
  /** The resource this token must have been issued for (RFC 8707). */
  audience: string | string[];
  /** Defaults to AUTH_SERVER_ISSUER. */
  issuer?: string;
  /** Defaults to the issuer's own key set (remote, cached). Inject for tests or same-process use. */
  keys?: JWTVerifyGetKey;
};

export class AccessTokenError extends Error {
  constructor(
    readonly code: 'invalid_token' | 'auth_server_disabled',
    message: string,
  ) {
    super(message);
    this.name = 'AccessTokenError';
  }
}

const remoteKeys = new Map<string, JWTVerifyGetKey>();

function keysFor(issuer: string): JWTVerifyGetKey {
  let keys = remoteKeys.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(
      new URL(`${issuer}${AUTH_SERVER_API_BASE_PATH}/jwks`),
      {
        cooldownDuration: 30_000,
        cacheMaxAge: 10 * 60_000,
      },
    );
    remoteKeys.set(issuer, keys);
  }
  return keys;
}

/**
 * Verifies an access token issued by this authorization server and returns who is calling.
 * Checks signature (only ES256 from the issuer's own key set), issuer, audience and expiry.
 * It does not apply the whitelist or any scope rule: callers do, with {@link isPersonAllowed}.
 * Errors never contain the token.
 */
export async function verifyAccessToken(
  token: string,
  options: VerifyAccessTokenOptions,
): Promise<VerifiedAccessToken> {
  let issuer = options.issuer;
  if (!issuer) {
    const config = loadAuthServerConfig();
    // Kill switch also stops the resource side: fail closed.
    if (!config.enabled) {
      throw new AccessTokenError(
        'auth_server_disabled',
        'Authorization server is off',
      );
    }
    issuer = config.issuer;
  }
  try {
    const { payload } = await jwtVerify(
      token,
      options.keys ?? keysFor(issuer),
      {
        issuer,
        audience: options.audience,
        algorithms: ['ES256'],
        requiredClaims: ['sub', 'exp', 'iat'],
      },
    );
    const clientId = (payload.client_id ?? payload.azp) as unknown;
    if (typeof payload.sub !== 'string' || typeof clientId !== 'string') {
      throw new Error('missing claims');
    }
    return {
      sub: payload.sub,
      clientId,
      scopes:
        typeof payload.scope === 'string'
          ? payload.scope.split(' ').filter(Boolean)
          : [],
      aud: Array.isArray(payload.aud)
        ? payload.aud
        : payload.aud
        ? [payload.aud]
        : [],
    };
  } catch {
    throw new AccessTokenError('invalid_token', 'Invalid access token');
  }
}
