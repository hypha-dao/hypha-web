import { describe, expect, it } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import type { AuthServerConfig } from '@hypha-platform/auth-server/server';
import {
  resolveAuthServerToken,
  tokenMatchesRegistryClient,
} from '../as-caller';

const ISSUER = 'https://auth.example.org';
const AUDIENCE = 'https://app.example.org/api/v2';
const PERSON = 'did:privy:allowed1';

const config = {
  enabled: true,
  issuer: ISSUER,
  resources: [AUDIENCE],
  allowedPersonIds: new Set([PERSON]),
} as unknown as AuthServerConfig;

const { privateKey, publicKey } = await generateKeyPair('ES256');
const keys = async () => publicKey;

async function token(
  over: {
    sub?: string;
    aud?: string;
    scope?: string;
    iss?: string;
    exp?: string;
  } = {},
) {
  return new SignJWT({
    client_id: 'https://client.example.com/cimd.json',
    scope: over.scope ?? 'spaces:read offline_access',
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'at+jwt' })
    .setSubject(over.sub ?? PERSON)
    .setIssuer(over.iss ?? ISSUER)
    .setAudience(over.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(over.exp ?? '10m')
    .sign(privateKey);
}

const req = (bearer?: string) =>
  new Request('https://app.example.org/api/v2/spaces/x/memberships/me', {
    headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
  });

describe('resolveAuthServerToken (v2 spike)', () => {
  it('accepts a valid token for the v2 resource', async () => {
    const r = await resolveAuthServerToken(req(await token()), config, keys);
    expect(r).toMatchObject({ kind: 'ok', sub: PERSON });
  });

  it('leaves other tokens and no token to the existing path', async () => {
    const privy = await token({ iss: 'privy.io' });
    expect(await resolveAuthServerToken(req(privy), config, keys)).toEqual({
      kind: 'not-as-token',
    });
    expect(await resolveAuthServerToken(req(), config, keys)).toEqual({
      kind: 'not-as-token',
    });
    expect(await resolveAuthServerToken(req('garbage'), config, keys)).toEqual({
      kind: 'not-as-token',
    });
  });

  it('is off when the authorization server is disabled', async () => {
    const off = { enabled: false } as never;
    expect(await resolveAuthServerToken(req(await token()), off, keys)).toEqual(
      { kind: 'not-as-token' },
    );
  });

  it('refuses our token when v2 is not a listed resource', async () => {
    const noV2 = { ...config, resources: ['https://x/other'] } as never;
    expect(
      await resolveAuthServerToken(req(await token()), noV2, keys),
    ).toMatchObject({ kind: 'failure', status: 401 });
  });

  it('refuses a token issued for another audience, an expired one and a bad signature', async () => {
    const other = await token({ aud: 'https://app.example.org/api/auth/test' });
    expect(
      await resolveAuthServerToken(req(other), config, keys),
    ).toMatchObject({ kind: 'failure', status: 401 });
    const expired = await token({ exp: '-1m' });
    expect(
      await resolveAuthServerToken(req(expired), config, keys),
    ).toMatchObject({ kind: 'failure', status: 401 });
    const { publicKey: otherKey } = await generateKeyPair('ES256');
    expect(
      await resolveAuthServerToken(
        req(await token()),
        config,
        async () => otherKey,
      ),
    ).toMatchObject({ kind: 'failure', status: 401 });
  });

  it('applies the allowlist and the scope again', async () => {
    const denied = await token({ sub: 'did:privy:nobody' });
    expect(
      await resolveAuthServerToken(req(denied), config, keys),
    ).toMatchObject({ kind: 'failure', status: 403, error: 'access_denied' });
    const noScope = await token({ scope: 'offline_access' });
    expect(
      await resolveAuthServerToken(req(noScope), config, keys),
    ).toMatchObject({ kind: 'failure', status: 403 });
  });
});

describe('tokenMatchesRegistryClient', () => {
  it('requires the token client id to equal the registry slug of the key', () => {
    expect(tokenMatchesRegistryClient('test-app', 'test-app')).toBe(true);
    expect(tokenMatchesRegistryClient('other-app', 'test-app')).toBe(false);
  });

  it('never matches a CIMD url client id (those carry no client key)', () => {
    expect(
      tokenMatchesRegistryClient(
        'https://client.example.com/cimd.json',
        'test-app',
      ),
    ).toBe(false);
  });

  it('the token the resolver returns carries the client id to compare', async () => {
    const r = await resolveAuthServerToken(req(await token()), config, keys);
    expect(r).toMatchObject({
      kind: 'ok',
      clientId: 'https://client.example.com/cimd.json',
    });
  });
});
