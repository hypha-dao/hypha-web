import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import * as h from '../testing/harness';
import { createAuthServerHandler } from '../handler';
import { parseOrigins } from '../config';
import { resetRegistrationLimiter } from '../registration';

const run = h.TEST_DB_URL ? describe : describe.skip;
const DEV = 'http://localhost:6274';
const OTHER = 'https://evil.example.com';

describe('AUTH_SERVER_CORS_ORIGINS parsing', () => {
  it('keeps exact origins only; no wildcards, paths or junk; default empty', () => {
    expect(parseOrigins(undefined)).toEqual([]);
    expect(
      parseOrigins(
        `${DEV}, ${DEV}/, *, https://*.example.com, ${OTHER}/path, ftp://x.test, not a url, http://127.0.0.1:6274`,
      ),
    ).toEqual([DEV, 'http://127.0.0.1:6274']);
  });
});

run('CORS: narrow, per endpoint', () => {
  let s: h.Harness;
  let handle: (r: Request) => Promise<Response>;
  beforeAll(async () => {
    s = await h.makeServer({
      AUTH_SERVER_SECRET: 'contract-test-secret-'.padEnd(48, 'x'),
      AUTH_SERVER_CORS_ORIGINS: DEV,
      AUTH_SERVER_DCR_ENABLED: 'true',
    });
    await h.resetAsTables(s.pool);
    handle = createAuthServerHandler(
      () => s.config,
      () => s,
    );
  });
  afterAll(async () => {
    await s.pool.end();
  });
  beforeEach(() => resetRegistrationLimiter(s.pool));

  const call = (path: string, init: RequestInit = {}) =>
    handle(h.req(path, init));
  const preflight = (path: string, origin: string, method: string) =>
    call(path, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': method,
        'access-control-request-headers': 'content-type',
      },
    });

  it('metadata and JWKS answer any origin with *, no credentials', async () => {
    for (const [path, methods] of [
      ['/.well-known/oauth-authorization-server', 'GET, HEAD'],
      ['/api/auth/jwks.json', 'GET'],
    ] as const) {
      const res = await call(path, { headers: { origin: OTHER } });
      expect(res.status, path).toBe(200);
      expect(res.headers.get('access-control-allow-origin')).toBe('*');
      expect(res.headers.get('access-control-allow-credentials')).toBeNull();
      const pre = await preflight(path, OTHER, 'GET');
      expect(pre.status, path).toBe(204);
      expect(pre.headers.get('access-control-allow-origin')).toBe('*');
      expect(pre.headers.get('access-control-allow-methods')).toBe(methods);
    }
  });

  it('token and register: only a listed origin, echoed, with Vary; others get nothing', async () => {
    for (const path of [
      '/api/auth/oauth2/token',
      '/api/auth/oauth2/register',
    ]) {
      const pre = await preflight(path, DEV, 'POST');
      expect(pre.status, path).toBe(204);
      expect(pre.headers.get('access-control-allow-origin')).toBe(DEV);
      expect(pre.headers.get('vary')).toContain('Origin');
      expect(pre.headers.get('access-control-allow-methods')).toBe('POST');
      expect(pre.headers.get('access-control-allow-headers')).toBe(
        'Content-Type',
      );
      expect(pre.headers.get('access-control-allow-credentials')).toBeNull();

      const refused = await preflight(path, OTHER, 'POST');
      expect(refused.status, path).toBe(404);
      expect(refused.headers.get('access-control-allow-origin')).toBeNull();
      const wrongMethod = await preflight(path, DEV, 'GET');
      expect(wrongMethod.status, path).toBe(404);
    }
  });

  it('real responses carry the headers, errors included; unlisted origins get none', async () => {
    const body = JSON.stringify({
      redirect_uris: ['http://localhost:6274/cb'],
    });
    const json = { 'content-type': 'application/json' };
    const ok = await call('/api/auth/oauth2/register', {
      method: 'POST',
      headers: { ...json, origin: DEV },
      body,
    });
    expect(ok.status).toBe(201);
    expect(ok.headers.get('access-control-allow-origin')).toBe(DEV);
    const bad = await call('/api/auth/oauth2/register', {
      method: 'POST',
      headers: { ...json, origin: DEV },
      body: '{}',
    });
    expect(bad.status).toBe(400);
    expect(bad.headers.get('access-control-allow-origin')).toBe(DEV);
    const tok = await call('/api/auth/oauth2/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: DEV,
      },
      body: 'grant_type=authorization_code',
    });
    expect(tok.status).toBeGreaterThanOrEqual(400);
    expect(tok.headers.get('access-control-allow-origin')).toBe(DEV);
    const other = await call('/api/auth/oauth2/register', {
      method: 'POST',
      headers: { ...json, origin: OTHER },
      body,
    });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('every other endpoint has no CORS, not even a preflight', async () => {
    for (const path of [
      '/api/auth/oauth2/authorize',
      '/api/auth/oauth2/consent',
      '/api/auth/oauth2/revoke',
      '/api/auth/provider/sign-in',
      '/api/auth/oauth2/introspect',
    ]) {
      const pre = await preflight(path, DEV, 'POST');
      expect(pre.status, path).toBe(404);
      expect(pre.headers.get('access-control-allow-origin')).toBeNull();
    }
  });

  it('with the list empty (default) nothing is allowed on token and register', async () => {
    const empty = await h.makeServer({
      AUTH_SERVER_SECRET: 'contract-test-secret-'.padEnd(48, 'x'),
    });
    try {
      const hh = createAuthServerHandler(
        () => empty.config,
        () => empty,
      );
      const res = await hh(
        h.req('/api/auth/oauth2/token', {
          method: 'OPTIONS',
          headers: {
            origin: DEV,
            'access-control-request-method': 'POST',
          },
        }),
      );
      expect(res.status).toBe(404);
    } finally {
      await empty.pool.end();
    }
  });
});
