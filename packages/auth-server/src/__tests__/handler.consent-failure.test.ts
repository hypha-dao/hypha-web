import { describe, it, expect, vi } from 'vitest';
import { createAuthServerHandler } from '../handler';
import type { AuthServerConfig } from '../config';

vi.mock('@better-auth/oauth-provider', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  verifyOAuthQueryParams: async () => true,
}));
vi.mock('../grants', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  assertSpacesExist: async () => undefined,
  writeGrant: async () => {
    throw new Error('database unavailable');
  },
}));

const config = {
  enabled: true,
  host: 'auth.localhost:3000',
  corsAllowedOrigins: [],
  dcrEnabled: false,
} as unknown as AuthServerConfig;

describe('a grant write that fails after the library accepted the consent', () => {
  it('returns an error, withholds the code and drops the stored consent so the picker shows again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const queries: { sql: string; params: unknown[] }[] = [];
    const server = {
      config: { secret: 'handler-test-secret-'.padEnd(48, 'x') },
      pool: {
        query: async (sql: string, params: unknown[]) => {
          queries.push({ sql, params });
          return { rows: [] };
        },
      },
      auth: {
        handler: async () =>
          new Response(JSON.stringify({ url: 'http://app/cb?code=secret' }), {
            status: 200,
          }),
        api: { getSession: async () => ({ user: { id: 'did:privy:a' } }) },
      },
    };
    const handle = createAuthServerHandler(
      () => config,
      () => server as never,
    );
    const res = await handle(
      new Request('http://auth.localhost:3000/api/auth/oauth2/consent', {
        method: 'POST',
        headers: {
          host: 'auth.localhost:3000',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          accept: true,
          scope: 'spaces:read',
          space_grants: [1],
          oauth_query: 'client_id=app-1&sig=x',
          expected_person: 'did:privy:a',
        }),
      }),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('code=');
    const del = queries.filter((q) =>
      q.sql.includes('delete from as_oauth_consent'),
    );
    expect(del).toHaveLength(1);
    expect(del[0]!.params).toEqual(['did:privy:a', 'app-1']);
  });
});
