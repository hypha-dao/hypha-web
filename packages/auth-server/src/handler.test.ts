import { describe, it, expect, vi } from 'vitest';
import { createAuthServerHandler } from './handler';
import type { AuthServerConfig } from './config';

const ORIGIN = 'http://localhost:6274';

const config = {
  enabled: true,
  host: 'auth.localhost:3000',
  corsAllowedOrigins: [ORIGIN],
  dcrEnabled: false,
} as unknown as AuthServerConfig;

describe('handler error path', () => {
  it('a failing request still carries CORS headers for an allowed origin', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handle = createAuthServerHandler(
      () => config,
      () => {
        throw new Error('boom');
      },
    );
    const res = await handle(
      new Request('http://auth.localhost:3000/api/auth/oauth2/token', {
        method: 'POST',
        headers: { origin: ORIGIN, host: 'auth.localhost:3000' },
      }),
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(await res.json()).toEqual({ error: 'server_error' });
  });

  it('no CORS header for an origin that is not allowed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handle = createAuthServerHandler(
      () => config,
      () => {
        throw new Error('boom');
      },
    );
    const res = await handle(
      new Request('http://auth.localhost:3000/api/auth/oauth2/token', {
        method: 'POST',
        headers: {
          origin: 'https://evil.example.com',
          host: 'auth.localhost:3000',
        },
      }),
    );
    expect(res.status).toBe(500);
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
