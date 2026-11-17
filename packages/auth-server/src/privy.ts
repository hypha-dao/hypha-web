import { createRemoteJWKSet, jwtVerify } from 'jose';

export type PrivyVerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: string };

export type PrivyTokenVerifier = (token: string) => Promise<PrivyVerifyResult>;

const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

/**
 * Verifies a Privy access token with Privy's public keys (no app secret involved) and
 * returns the Privy user id. The token is only read here: it is never stored, logged or
 * passed on.
 */
export function createPrivyTokenVerifier(
  appId: string,
  jwksUrlOverride?: string,
): PrivyTokenVerifier {
  const jwksUrl =
    jwksUrlOverride ?? `https://auth.privy.io/api/v1/apps/${appId}/jwks.json`;
  return async (token) => {
    try {
      let jwks = jwksByUrl.get(jwksUrl);
      if (!jwks) {
        jwks = createRemoteJWKSet(new URL(jwksUrl));
        jwksByUrl.set(jwksUrl, jwks);
      }
      const { payload } = await jwtVerify(token, jwks, {
        issuer: 'privy.io',
        audience: appId,
        algorithms: ['ES256'],
      });
      if (typeof payload.sub !== 'string' || !payload.sub) {
        return { ok: false, reason: 'token has no subject' };
      }
      return { ok: true, userId: payload.sub };
    } catch {
      // Never include the token or the library message (which can echo claims).
      return { ok: false, reason: 'invalid token' };
    }
  };
}
