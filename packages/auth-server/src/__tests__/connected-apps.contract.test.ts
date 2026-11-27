import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { decodeJwt } from 'jose';
import * as h from '../testing/harness';
import { createAuthDbPool, type AuthDbPool } from '../db';
import { disconnectApp, listConnectedApps } from '../connected-apps';
import { SPACE_GRANTS_CLAIM, readGrant } from '../grants';
import {
  CONNECTED_APPS_DISCONNECT_PATH,
  CONNECTED_APPS_SPACES_PATH,
} from '../config';

const run = h.TEST_DB_URL ? describe : describe.skip;
const SECRET = 'connected-apps-contract-secret-'.padEnd(48, 'x');
const SECOND = 'did:privy:allowed3';
const ALLOWED = `${h.PERSON},${SECOND}`;

/**
 * A pool whose connections run `onRotation` once, right after the library's first step of a
 * refresh-token rotation (it marks the old row revoked, then inserts the new row separately).
 */
function poolWithRotationHook(
  url: string,
  onRotation: { fire: (() => Promise<void>) | null },
): AuthDbPool {
  const real = createAuthDbPool(url);
  const isRotation = (text: unknown) =>
    typeof text === 'string' &&
    /update\s+"?as_oauth_refresh_token"?/i.test(text) &&
    /"?revoked"?/i.test(text);
  const wrap = <T extends { query: (...a: never[]) => unknown }>(target: T) =>
    new Proxy(target, {
      get(obj, prop, receiver) {
        if (prop !== 'query') return Reflect.get(obj, prop, receiver);
        return async (...args: unknown[]) => {
          const result = await (
            obj.query as unknown as (...a: unknown[]) => Promise<unknown>
          ).apply(obj, args);
          const text =
            typeof args[0] === 'object' && args[0] !== null
              ? (args[0] as { text?: unknown }).text
              : args[0];
          if (onRotation.fire && isRotation(text)) {
            const fire = onRotation.fire;
            onRotation.fire = null;
            await fire();
          }
          return result;
        };
      },
    });
  return new Proxy(real, {
    get(obj, prop, receiver) {
      if (prop === 'query') return wrap(obj).query;
      if (prop === 'connect') return async () => wrap(await obj.connect());
      return Reflect.get(obj, prop, receiver);
    },
  }) as AuthDbPool;
}

run('connected apps: list, change spaces, disconnect safely', () => {
  let s: h.Harness;
  let spaceA: number;
  let spaceB: number;
  const hook: { fire: (() => Promise<void>) | null } = { fire: null };

  beforeAll(async () => {
    s = await h.makeServer(
      { AUTH_SERVER_SECRET: SECRET, AUTH_SERVER_ALLOWED_PERSON_IDS: ALLOWED },
      { pool: poolWithRotationHook(h.TEST_DB_URL!, hook) },
    );
    await h.resetAsTables(s.pool);
    await h.seedPeople(s.pool, [h.PERSON, SECOND]);
    const ids: number[] = [];
    for (const slug of ['g2b-space-a', 'g2b-space-b']) {
      const { rows } = await s.pool.query(
        `insert into spaces (title, slug) values ($1, $1)
         on conflict (slug) do update set title = excluded.title returning id`,
        [slug],
      );
      ids.push(rows[0].id);
    }
    [spaceA, spaceB] = ids as [number, number];
  });
  afterAll(async () => {
    await s.pool.end();
  });
  beforeEach(async () => {
    hook.fire = null;
    await s.pool.query('delete from as_oauth_access_token');
    await s.pool.query('delete from as_oauth_refresh_token');
    await s.pool.query('delete from as_oauth_consent');
    await s.pool.query('delete from as_client_grant');
  });

  const refresh = (rt: string) =>
    h.appTokenRequest(s, {
      grant_type: 'refresh_token',
      refresh_token: rt,
      client_id: h.CLIENT_ID,
      resource: h.RESOURCE,
    });
  const refreshRows = async (person = h.PERSON) =>
    (
      await s.pool.query(
        'select count(*)::int as n from as_oauth_refresh_token where "userId" = $1',
        [person],
      )
    ).rows[0].n as number;

  /** A page action, signed in as `jar`'s person. */
  const action = (
    path: string,
    jar: h.CookieJar,
    body: Record<string, unknown>,
    origin = h.ISSUER,
  ) =>
    s.appHandler(
      h.req(`/api/auth${path}`, {
        method: 'POST',
        jar,
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify(body),
      }),
    );

  it('lists only the person’s own apps, with kind, spaces and last activity; no other person’s', async () => {
    await h.fullFlow(s, { spaceGrants: [spaceA] });
    await h.fullFlow(s, { person: SECOND, spaceGrants: 'all' });
    const mine = await listConnectedApps(s.pool, h.PERSON);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      clientId: h.CLIENT_ID,
      kind: 'cimd',
      name: 'Test AI App',
    });
    expect(mine[0]!.spaces).toEqual([
      { id: spaceA, title: 'g2b-space-a', slug: 'g2b-space-a' },
    ]);
    expect(mine[0]!.lastActiveAt).not.toBeNull();
    const theirs = await listConnectedApps(s.pool, SECOND);
    expect(theirs).toHaveLength(1);
    expect(theirs[0]!.spaces).toBe('all');
    expect(theirs[0]!.id).not.toBe(mine[0]!.id);
  });

  it('changing spaces narrows the grant without disconnecting; the next refresh carries exactly the new list', async () => {
    const f = await h.fullFlow(s, { spaceGrants: 'all' });
    const [app] = await listConnectedApps(s.pool, h.PERSON);
    const res = await action(CONNECTED_APPS_SPACES_PATH, f.jar, {
      app: app!.id,
      space_grants: [spaceB],
      expected_person: h.PERSON,
    });
    expect(res.status).toBe(200);
    expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toEqual([spaceB]);
    const r = await refresh(f.token!.body.refresh_token as string);
    expect(r.res.status).toBe(200);
    expect(decodeJwt(r.body.access_token)[SPACE_GRANTS_CLAIM]).toEqual([
      spaceB,
    ]);
    // Still connected: the consent is untouched.
    expect(await listConnectedApps(s.pool, h.PERSON)).toHaveLength(1);
  });

  it('a change without a valid choice is refused and the grant stays as it was (never widened)', async () => {
    const f = await h.fullFlow(s, { spaceGrants: [spaceA] });
    const [app] = await listConnectedApps(s.pool, h.PERSON);
    for (const bad of [undefined, null, [], ['1'], 'everything', [999999999]]) {
      const res = await action(CONNECTED_APPS_SPACES_PATH, f.jar, {
        app: app!.id,
        space_grants: bad,
        expected_person: h.PERSON,
      });
      expect(res.status).toBe(400);
    }
    expect(await readGrant(s.pool, h.PERSON, h.CLIENT_ID)).toEqual([spaceA]);
  });

  it('a person cannot see, change or disconnect another person’s app', async () => {
    const mine = await h.fullFlow(s, { spaceGrants: [spaceA] });
    const theirs = await h.fullFlow(s, { person: SECOND, spaceGrants: 'all' });
    const [theirApp] = await listConnectedApps(s.pool, SECOND);
    const change = await action(CONNECTED_APPS_SPACES_PATH, mine.jar, {
      app: theirApp!.id,
      space_grants: [spaceA],
      expected_person: h.PERSON,
    });
    expect(change.status).toBe(404);
    const disconnect = await action(CONNECTED_APPS_DISCONNECT_PATH, mine.jar, {
      app: theirApp!.id,
      expected_person: h.PERSON,
    });
    expect(disconnect.status).toBe(404);
    expect(await readGrant(s.pool, SECOND, h.CLIENT_ID)).toBe('all');
    const r = await refresh(theirs.token!.body.refresh_token as string);
    expect(r.res.status).toBe(200);
  });

  it('actions need this server as origin and the account the page showed', async () => {
    const f = await h.fullFlow(s, { spaceGrants: 'all' });
    const [app] = await listConnectedApps(s.pool, h.PERSON);
    const body = { app: app!.id, expected_person: h.PERSON };
    expect(
      (
        await action(
          CONNECTED_APPS_DISCONNECT_PATH,
          f.jar,
          body,
          'https://evil.example',
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await action(CONNECTED_APPS_DISCONNECT_PATH, f.jar, {
          ...body,
          expected_person: SECOND,
        })
      ).status,
    ).toBe(409);
    expect(
      (await action(CONNECTED_APPS_DISCONNECT_PATH, new h.CookieJar(), body))
        .status,
    ).toBe(401);
    expect(await listConnectedApps(s.pool, h.PERSON)).toHaveLength(1);
  });

  it('disconnect from the page removes the app; the next refresh is refused', async () => {
    const f = await h.fullFlow(s, { spaceGrants: 'all' });
    const [app] = await listConnectedApps(s.pool, h.PERSON);
    const res = await action(CONNECTED_APPS_DISCONNECT_PATH, f.jar, {
      app: app!.id,
      expected_person: h.PERSON,
    });
    expect(res.status).toBe(200);
    expect(await listConnectedApps(s.pool, h.PERSON)).toEqual([]);
    const r = await refresh(f.token!.body.refresh_token as string);
    expect(r.res.status).toBe(400);
    expect(await refreshRows()).toBe(0);
  });

  it('a disconnect between the two steps of a refresh rotation leaves no usable refresh token', async () => {
    const f = await h.fullFlow(s, { spaceGrants: 'all' });
    hook.fire = () => disconnectApp(s.pool, h.PERSON, h.CLIENT_ID);
    const r = await refresh(f.token!.body.refresh_token as string);
    expect(hook.fire).toBeNull(); // the disconnect ran inside the rotation
    expect(r.res.status).toBe(400);
    expect(r.body.error).toBe('invalid_grant');
    expect(r.body.refresh_token).toBeUndefined();
    expect(await refreshRows()).toBe(0);
  });

  it('a code exchanged after a disconnect gives no token', async () => {
    const pkce = h.makePkce();
    const jar = new h.CookieJar();
    const u = h.authorizeUrl(pkce);
    const a = await s.handler(h.req(u.pathname + u.search));
    const login = await h.signIn(
      s,
      jar,
      new URL(a.headers.get('location')!, h.ISSUER).search.slice(1),
    );
    const c = await h.consent(
      s,
      jar,
      new URL(login.body.url, h.ISSUER).search.slice(1),
      'spaces:read offline_access',
    );
    const code = new URL(c.body.url).searchParams.get('code')!;
    await disconnectApp(s.pool, h.PERSON, h.CLIENT_ID);
    const t = await h.appTokenRequest(s, {
      grant_type: 'authorization_code',
      code,
      code_verifier: pkce.verifier,
      client_id: h.CLIENT_ID,
      redirect_uri: h.REDIRECT_URI,
      resource: h.RESOURCE,
    });
    expect(t.res.status).toBe(400);
    expect(await refreshRows()).toBe(0);
  });

  it('a connected app without a resource (opaque access token) still gets its tokens', async () => {
    const f = await h.fullFlow(s, { noResource: true, tokenViaApp: true });
    expect(f.token!.res.status).toBe(200);
    expect(String(f.token!.body.access_token).split('.')).toHaveLength(1);
  });
});
