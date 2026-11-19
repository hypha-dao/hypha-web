import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';

export const TEST_ISSUER = 'http://auth.localhost:3000';
export const TEST_PERSON = 'did:privy:person1';
export const TEST_CLIENT = 'https://client.example.com/cimd.json';

/** A throwaway token issuer: signs ES256 access tokens and exposes the matching key set. */
export async function createTestIssuer() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'k1' };
  const keys = createLocalJWKSet({ keys: [jwk] });
  const sign = (
    audience: string,
    over: {
      sub?: string;
      scope?: string;
      extra?: Record<string, unknown>;
    } = {},
  ) =>
    new SignJWT({
      client_id: TEST_CLIENT,
      scope: over.scope ?? 'spaces:read',
      ...over.extra,
    })
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject(over.sub ?? TEST_PERSON)
      .setIssuer(TEST_ISSUER)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
  return { keys, sign };
}
