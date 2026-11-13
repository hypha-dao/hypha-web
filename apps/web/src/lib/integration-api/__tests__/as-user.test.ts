import { describe, expect, it, vi } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';

vi.mock('server-only', () => ({}));
vi.mock('@hypha-platform/storage-postgres', () => ({ db: {} }));
vi.mock('../../../app/(auth)/auth/_lib/server', () => ({
  getAuthServerConfig: vi.fn(),
}));
const findPersonBySub = vi.fn();
vi.mock('@hypha-platform/core/server', () => ({
  findPersonBySub: (...a: unknown[]) => findPersonBySub(...a),
  authenticateIntegrationUser: vi.fn(),
}));

import type { AuthServerConfig } from '@hypha-platform/auth-server/server';
import { authenticateIntegrationUserWithAs } from '../as-user';

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
const client = { id: 7, slug: 'test-app', name: 'T', scopes: [] } as never;

async function token(
  over: { sub?: string; aud?: string; scope?: string; client?: string } = {},
) {
  return new SignJWT({
    client_id: over.client ?? 'test-app',
    scope: over.scope ?? 'spaces:read agreements:vote offline_access',
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'at+jwt' })
    .setSubject(over.sub ?? PERSON)
    .setIssuer(ISSUER)
    .setAudience(over.aud ?? AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey);
}
const req = (bearer: string) =>
  new Request('https://app.example.org/api/integration/v1/actions', {
    headers: { authorization: `Bearer ${bearer}` },
  });
const call = async (t: string, scope: string, c = client) =>
  authenticateIntegrationUserWithAs(
    req(t),
    { client: c, scope },
    { config, keys },
  );

describe('authenticateIntegrationUserWithAs', () => {
  it('accepts a valid token with the route scope and maps it to the person', async () => {
    findPersonBySub.mockResolvedValueOnce({ id: 42, name: 'Pat', slug: 'pat' });
    const r = await call(await token(), 'agreements:vote');
    expect(r).toMatchObject({ ok: true, user: { id: 42, slug: 'pat' } });
    expect(findPersonBySub).toHaveBeenLastCalledWith(
      { sub: PERSON },
      expect.anything(),
    );
  });

  it('403 insufficient_scope when the token lacks the route scope', async () => {
    const t = await token({ scope: 'spaces:read offline_access' });
    expect(await call(t, 'agreements:vote')).toMatchObject({
      ok: false,
      status: 403,
      code: 'insufficient_scope',
    });
  });

  it('403 client_mismatch when the token client is not the key client', async () => {
    const t = await token({ client: 'other-app' });
    expect(await call(t, 'spaces:read')).toMatchObject({
      ok: false,
      status: 403,
      code: 'client_mismatch',
    });
  });

  it('403 client_mismatch without a client context (never accepted blind)', async () => {
    const r = await authenticateIntegrationUserWithAs(
      req(await token()),
      { scope: 'spaces:read' },
      { config, keys },
    );
    expect(r).toMatchObject({ ok: false, code: 'client_mismatch' });
  });

  it('401 for another audience, 403 for a person off the allowlist', async () => {
    expect(
      await call(
        await token({ aud: 'https://x.example/api/v2' }),
        'spaces:read',
      ),
    ).toMatchObject({ ok: false, status: 401 });
    expect(
      await call(await token({ sub: 'did:privy:other' }), 'spaces:read'),
    ).toMatchObject({ ok: false, status: 403 });
  });

  it('403 profile_required when the person has no Hypha profile', async () => {
    findPersonBySub.mockResolvedValueOnce(null);
    expect(await call(await token(), 'spaces:read')).toMatchObject({
      ok: false,
      status: 403,
      code: 'profile_required',
    });
  });

  it('returns null for a token that is not ours, so the Privy path can take it', async () => {
    const foreign = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256' })
      .setIssuer('privy.io')
      .setSubject('x')
      .sign(privateKey);
    expect(await call(foreign, 'spaces:read')).toBeNull();
  });
});
