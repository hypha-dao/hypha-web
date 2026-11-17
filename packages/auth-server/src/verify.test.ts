import { describe, it, expect, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AccessTokenError, verifyAccessToken } from './verify';

const ISSUER = 'http://auth.localhost:3000';
const AUDIENCE = 'https://resource.example.com/api';

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('ES256');
  const jwk = { ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'k1' };
  return { keys: createLocalJWKSet({ keys: [jwk] }), privateKey };
}

function sign(privateKey: CryptoKey, extra: Record<string, unknown> = {}) {
  return new SignJWT({
    client_id: 'https://client.example.com/cimd.json',
    scope: 'spaces:read',
    ...extra,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
    .setSubject('did:privy:person1')
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);
}

describe('verifyAccessToken', () => {
  it('accepts a plain bearer token', async () => {
    const { keys, privateKey } = await setup();
    const token = await sign(privateKey);
    const verified = await verifyAccessToken(token, {
      audience: AUDIENCE,
      issuer: ISSUER,
      keys,
    });
    expect(verified.sub).toBe('did:privy:person1');
    expect(verified.scopes).toEqual(['spaces:read']);
  });

  it.each([
    ['a DPoP binding', { cnf: { jkt: 'thumbprint' } }],
    ['an mTLS binding', { cnf: { 'x5t#S256': 'thumbprint' } }],
  ])('rejects a sender-constrained token (%s)', async (_name, extra) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { keys, privateKey } = await setup();
    const token = await sign(privateKey, extra);
    await expect(
      verifyAccessToken(token, { audience: AUDIENCE, issuer: ISSUER, keys }),
    ).rejects.toBeInstanceOf(AccessTokenError);
  });
});
