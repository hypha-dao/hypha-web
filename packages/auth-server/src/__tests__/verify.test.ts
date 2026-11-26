import { describe, it, expect, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { AccessTokenError, verifyAccessToken } from '../verify';

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
    space_grants: 'all',
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

  it('returns the grant claim: "all" or the space ids', async () => {
    const { keys, privateKey } = await setup();
    const opts = { audience: AUDIENCE, issuer: ISSUER, keys };
    expect(
      (await verifyAccessToken(await sign(privateKey), opts)).spaceGrants,
    ).toBe('all');
    expect(
      (
        await verifyAccessToken(
          await sign(privateKey, { space_grants: [3, 9] }),
          opts,
        )
      ).spaceGrants,
    ).toEqual([3, 9]);
    expect(
      (
        await verifyAccessToken(
          await sign(privateKey, { space_grants: [] }),
          opts,
        )
      ).spaceGrants,
    ).toEqual([]);
  });

  it.each([
    ['missing', { space_grants: undefined }],
    ['null', { space_grants: null }],
    ['a string that is not "all"', { space_grants: 'everything' }],
    ['strings instead of numbers', { space_grants: ['3'] }],
    ['a fraction', { space_grants: [1.5] }],
    ['zero or negative', { space_grants: [0] }],
    ['a duplicate', { space_grants: [3, 3] }],
    ['an object', { space_grants: { 0: 3 } }],
    [
      'more than the cap',
      { space_grants: Array.from({ length: 201 }, (_, i) => i + 1) },
    ],
  ])('fails closed on a grant claim that is %s', async (_name, extra) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { keys, privateKey } = await setup();
    await expect(
      verifyAccessToken(await sign(privateKey, extra), {
        audience: AUDIENCE,
        issuer: ISSUER,
        keys,
      }),
    ).rejects.toBeInstanceOf(AccessTokenError);
  });
});
