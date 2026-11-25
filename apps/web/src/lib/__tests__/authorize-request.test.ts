import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  authorizeRequest,
  createRateSlot,
  type AuthorizeDeps,
  type Surface,
} from '../authorize-request';
import { TEST_ISSUER, TEST_PERSON, createTestIssuer } from './test-issuer';

const AUDIENCE = 'https://mcp.example.com/mcp';
const surface: Surface = {
  audience: AUDIENCE,
  scope: 'spaces:read',
  resourceMetadataUrl:
    'https://mcp.example.com/.well-known/oauth-protected-resource/mcp',
};

let issuer: Awaited<ReturnType<typeof createTestIssuer>>;
beforeAll(async () => {
  issuer = await createTestIssuer();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

const request = (token?: string) =>
  new Request(AUDIENCE, {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });

function deps(over: Partial<AuthorizeDeps> = {}) {
  const order: string[] = [];
  const base: AuthorizeDeps = {
    config: { issuer: TEST_ISSUER, allowedPersonIds: new Set([TEST_PERSON]) },
    keys: issuer.keys as never,
    resolve: async () => {
      order.push('resolver');
      return {
        ok: true,
        caller: { kind: 'user', person: { id: 1 }, address: '0x1', via: {} },
      } as never;
    },
    slot: {
      take: () => {
        order.push('slot');
        return { ok: true };
      },
    },
    ...over,
  };
  return { deps: base, order };
}

describe('authorizeRequest: guard, then resolver, then rate slot', () => {
  it('runs the three steps in that order for a valid token', async () => {
    const { deps: d, order } = deps();
    const r = await authorizeRequest(
      request(await issuer.sign(AUDIENCE)),
      surface,
      d,
    );
    expect(r.ok && r.access.kind).toBe('caller');
    expect(order).toEqual(['resolver', 'slot']);
  });

  it.each([['no token', undefined, 401, 'invalid_request']])(
    '%s: 401 with the challenge and the metadata URL, before the resolver',
    async (_n, token, status, error) => {
      const { deps: d, order } = deps();
      const r = await authorizeRequest(request(token), surface, d);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.response.status).toBe(status);
      const challenge = r.response.headers.get('www-authenticate') ?? '';
      expect(challenge).toContain(`error="${error}"`);
      expect(challenge).toContain(
        `resource_metadata="${surface.resourceMetadataUrl}"`,
      );
      expect(order).toEqual([]);
    },
  );

  it('a garbage bearer: 401 invalid_token, resolver and slot never run', async () => {
    const { deps: d, order } = deps();
    const r = await authorizeRequest(request('not-a-jwt'), surface, d);
    expect(r.ok === false && r.response.status).toBe(401);
    expect(order).toEqual([]);
  });

  it('a token for another audience is refused', async () => {
    const { deps: d, order } = deps();
    const r = await authorizeRequest(
      request(await issuer.sign('https://other.example.com/mcp')),
      surface,
      d,
    );
    expect(r.ok === false && r.response.status).toBe(401);
    expect(order).toEqual([]);
  });

  it('a missing scope: 403 insufficient_scope', async () => {
    const { deps: d } = deps();
    const r = await authorizeRequest(
      request(await issuer.sign(AUDIENCE, { scope: 'offline_access' })),
      surface,
      d,
    );
    expect(r.ok === false && r.response.status).toBe(403);
    expect(
      r.ok === false && r.response.headers.get('www-authenticate'),
    ).toContain('insufficient_scope');
  });

  it('a person off the allowlist is refused at once (checked on every request)', async () => {
    const { deps: d, order } = deps({
      config: {
        issuer: TEST_ISSUER,
        allowedPersonIds: new Set(['someone-else']),
      },
    });
    const r = await authorizeRequest(
      request(await issuer.sign(AUDIENCE)),
      surface,
      d,
    );
    expect(r.ok === false && r.response.status).toBe(403);
    expect(order).toEqual([]);
  });

  it('no profile is a clear refusal, not a guest, and takes no slot', async () => {
    const { deps: d, order } = deps({
      resolve: async () => ({
        ok: false,
        code: 'no_profile',
        message: 'No profile.',
      }),
    });
    const r = await authorizeRequest(
      request(await issuer.sign(AUDIENCE)),
      surface,
      d,
    );
    expect(r).toMatchObject({
      ok: true,
      access: {
        kind: 'refused',
        refusal: { code: 'no_profile', message: 'No profile.' },
      },
    });
    expect(order).toEqual([]);
  });

  it('a tripped limit is a refusal with retry info', async () => {
    let t = 0;
    const slot = createRateSlot({ limit: 1, windowMs: 60_000, now: () => t });
    const { deps: d } = deps({ slot });
    const token = await issuer.sign(AUDIENCE);
    expect((await authorizeRequest(request(token), surface, d)).ok).toBe(true);
    t = 10_000;
    const r = await authorizeRequest(request(token), surface, d);
    expect(r).toMatchObject({
      ok: true,
      access: {
        kind: 'refused',
        refusal: { code: 'rate_limited', retryAfterSeconds: 50 },
      },
    });
    t = 61_000;
    const again = await authorizeRequest(request(token), surface, d);
    expect(again.ok && again.access.kind).toBe('caller');
  });

  it('the client check can refuse before the resolver runs', async () => {
    const { deps: d, order } = deps();
    const r = await authorizeRequest(
      request(await issuer.sign(AUDIENCE)),
      {
        ...surface,
        checkClient: async () => new Response('{}', { status: 403 }),
      },
      d,
    );
    expect(r.ok === false && r.response.status).toBe(403);
    expect(order).toEqual([]);
  });
});

describe('authorizeRequest: the space grants of the token reach the resolver', () => {
  const claimsSeen = async (extra: Record<string, unknown>) => {
    let seen: unknown;
    const { deps: d } = deps({
      resolve: async (claims) => {
        seen = claims;
        return { ok: true, caller: { kind: 'user' } } as never;
      },
    });
    const r = await authorizeRequest(
      request(await issuer.sign(AUDIENCE, { extra })),
      surface,
      d,
    );
    return { r, seen: seen as { spaceGrants?: number[] | null } | undefined };
  };

  it('"all" becomes null (no restriction beyond the person\'s own rights)', async () => {
    const { seen } = await claimsSeen({ space_grants: 'all' });
    expect(seen?.spaceGrants).toBeNull();
  });

  it('a list is passed as it is, and an empty list stays empty (grants nothing)', async () => {
    expect(
      (await claimsSeen({ space_grants: [4, 9] })).seen?.spaceGrants,
    ).toEqual([4, 9]);
    expect((await claimsSeen({ space_grants: [] })).seen?.spaceGrants).toEqual(
      [],
    );
  });

  it.each([
    ['missing (a token from before G2a)', { space_grants: undefined }],
    ['null', { space_grants: null }],
    ['strings', { space_grants: ['4'] }],
    [
      'oversized',
      { space_grants: Array.from({ length: 201 }, (_, i) => i + 1) },
    ],
  ])(
    'a claim that is %s is a 401 and the resolver never runs',
    async (_n, extra) => {
      const { r, seen } = await claimsSeen(extra);
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.response.status).toBe(401);
      expect(r.response.headers.get('www-authenticate')).toContain(
        'invalid_token',
      );
      expect(seen).toBeUndefined();
    },
  );
});
