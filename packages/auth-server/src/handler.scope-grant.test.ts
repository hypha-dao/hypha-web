import { describe, it, expect, vi } from 'vitest';
import { createAuthServerHandler } from './handler';
import type { AuthServerConfig } from './config';

const writeGrant = vi.fn(async () => undefined);
vi.mock('@better-auth/oauth-provider', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  verifyOAuthQueryParams: async () => true,
}));
vi.mock('./grants', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  assertSpacesExist: async () => undefined,
  writeGrant: (...args: unknown[]) =>
    (writeGrant as (...a: unknown[]) => Promise<void>)(...args),
}));

const config = {
  enabled: true,
  host: 'auth.localhost:3000',
  corsAllowedOrigins: [],
  dcrEnabled: false,
} as unknown as AuthServerConfig;

const approve = async (scope: string) => {
  const server = {
    config: { secret: 'handler-test-secret-'.padEnd(48, 'x') },
    pool: { query: async () => ({ rows: [] }) },
    auth: {
      handler: async () =>
        new Response(JSON.stringify({ url: 'http://app/cb?code=c' }), {
          status: 200,
        }),
      api: { getSession: async () => ({ user: { id: 'did:privy:a' } }) },
    },
  };
  const handle = createAuthServerHandler(
    () => config,
    () => server as never,
  );
  return handle(
    new Request('http://auth.localhost:3000/api/auth/oauth2/consent', {
      method: 'POST',
      headers: {
        host: 'auth.localhost:3000',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        accept: true,
        scope,
        space_grants: 'all',
        oauth_query: 'client_id=app-1&sig=x',
        expected_person: 'did:privy:a',
      }),
    }),
  );
};

describe('the stored grant is only replaced by an approval of the read scope', () => {
  it('an approval without spaces:read leaves the stored grant alone', async () => {
    writeGrant.mockClear();
    const res = await approve('offline_access');
    expect(res.status).toBe(200);
    expect(writeGrant).not.toHaveBeenCalled();
  });

  it('an approval with spaces:read stores the choice', async () => {
    writeGrant.mockClear();
    const res = await approve('spaces:read offline_access');
    expect(res.status).toBe(200);
    expect(writeGrant).toHaveBeenCalledTimes(1);
  });
});
