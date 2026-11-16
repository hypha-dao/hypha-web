import { describe, it, expect } from 'vitest';
import { loadAuthServerConfig } from './config';
import { createAuthServerHandler } from './handler';

const ISSUER = 'http://auth.localhost:3000';
const config = loadAuthServerConfig({
  AUTH_SERVER_ENABLED: 'true',
  AUTH_SERVER_ISSUER: ISSUER,
  AUTH_SERVER_SECRET: 'x'.repeat(40),
  DEFAULT_DB_URL: 'postgres://unused',
  NEXT_PUBLIC_PRIVY_APP_ID: 'test-app',
});
if (!config.enabled) throw new Error('config');

// No server is ever built: the error page must not touch the database or the library.
const handle = createAuthServerHandler(
  () => config,
  () => {
    throw new Error('server must not be built for the error page');
  },
);
const get = (path: string, host = 'auth.localhost:3000', method = 'GET') =>
  handle(new Request(`${ISSUER}${path}`, { method, headers: { host } }));

describe('error page', () => {
  it('serves invalid_redirect as plain text, not a 404', async () => {
    const res = await get(
      '/api/auth/error?error=invalid_redirect&state=abc&error_description=x',
    );
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/^text\/plain/);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = await res.text();
    expect(body).toMatch(/did not register/);
    expect(body).toMatch(/start again/);
  });

  it('never echoes the request: unknown codes and injected markup get the fixed fallback', async () => {
    const payload = '<script>alert(1)</script>';
    for (const q of [
      `error=${encodeURIComponent(payload)}`,
      `error=invalid_redirect&error_description=${encodeURIComponent(
        payload,
      )}&state=${encodeURIComponent(payload)}`,
      `error=__proto__`,
      `error=constructor`,
      '',
    ]) {
      const body = await (await get(`/api/auth/error?${q}`)).text();
      expect(body, q).not.toContain('<');
      expect(body, q).not.toContain('alert');
      expect(body, q).toMatch(/start again/);
    }
    const fallback = await (await get('/api/auth/error?error=nope')).text();
    expect(fallback).toMatch(/Something went wrong/);
  });

  it('only on the auth host, only GET/HEAD', async () => {
    expect(
      (await get('/api/auth/error?error=x', 'other.example.com')).status,
    ).toBe(404);
    expect(
      (await get('/api/auth/error', 'auth.localhost:3000', 'POST')).status,
    ).toBe(404);
    expect(
      (await get('/api/auth/error', 'auth.localhost:3000', 'HEAD')).status,
    ).toBe(400);
  });
});
