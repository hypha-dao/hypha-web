import { afterEach, describe, expect, it, vi } from 'vitest';
import { onboardingLogLine } from '../redact';
import {
  clientKindOf,
  logOnboardingStep,
  onboardingStepOf,
  readErrorCode,
  readOnboardingParams,
} from '../onboarding-log';
import { createAuthServerHandler } from '../handler';
import type { AuthServerConfig } from '../config';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('onboardingLogLine (allow-list)', () => {
  it('writes kind, step, error code and redirect host', () => {
    expect(
      onboardingLogLine({
        clientKind: 'cimd',
        step: 'authorize',
        error: 'invalid_request',
        redirectHost: 'claude.ai',
      }),
    ).toBe(
      '[auth-server:onboarding] client_kind=cimd step=authorize error=invalid_request redirect_host=claude.ai',
    );
    expect(onboardingLogLine({ clientKind: 'registered', step: 'token' })).toBe(
      '[auth-server:onboarding] client_kind=registered step=token error=none redirect_host=none',
    );
  });

  it('drops anything outside the allow-list: tokens, codes, free text, full URLs, email', () => {
    const jwt = 'eyJhbGciOiJFUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJlLWJ5dGVz';
    const line = onboardingLogLine({
      clientKind: `cimd ${jwt}`,
      step: 'authorize code=abc123',
      error: `invalid_grant: bad code SECRETCODE ${jwt}`,
      redirectHost: 'https://a.example/cb?code=SECRETCODE&state=s',
    });
    expect(line).toBe(
      '[auth-server:onboarding] client_kind=unknown step=unknown error=none redirect_host=none',
    );
    expect(
      onboardingLogLine({
        clientKind: 'dcr',
        step: 'consent',
        error: 'person@example.com',
        redirectHost: 'person@example.com',
      }),
    ).toBe(
      '[auth-server:onboarding] client_kind=dcr step=consent error=none redirect_host=none',
    );
  });

  it('keeps a custom-scheme redirect as host or scheme only', () => {
    expect(
      onboardingLogLine({
        clientKind: 'registered',
        step: 'authorize',
        redirectHost: 'anysphere.cursor-mcp',
      }),
    ).toContain('redirect_host=anysphere.cursor-mcp');
    expect(
      onboardingLogLine({
        clientKind: 'registered',
        step: 'authorize',
        redirectHost: 'app:',
      }),
    ).toContain('redirect_host=app:');
  });
});

describe('step and parameter reading', () => {
  it('recognises only the three steps', () => {
    expect(onboardingStepOf('/api/auth/oauth2/authorize', 'GET')).toBe(
      'authorize',
    );
    expect(onboardingStepOf('/api/auth/oauth2/consent', 'POST')).toBe(
      'consent',
    );
    expect(onboardingStepOf('/api/auth/oauth2/token', 'POST')).toBe('token');
    expect(onboardingStepOf('/api/auth/oauth2/token', 'GET')).toBeNull();
    expect(onboardingStepOf('/api/auth/jwks.json', 'GET')).toBeNull();
  });

  it('reads client id and redirect from query, form and consent body', async () => {
    const q = new Request(
      'https://a/api/auth/oauth2/authorize?client_id=c1&redirect_uri=https%3A%2F%2Fx.example%2Fcb',
    );
    expect(await readOnboardingParams(q, 'authorize')).toEqual({
      clientId: 'c1',
      redirectUri: 'https://x.example/cb',
    });
    const form = new Request('https://a/api/auth/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=authorization_code&code=SECRET&client_id=c2&redirect_uri=cursor%3A%2F%2Fanysphere.cursor-mcp%2Fcb',
    });
    expect(await readOnboardingParams(form, 'token')).toEqual({
      clientId: 'c2',
      redirectUri: 'cursor://anysphere.cursor-mcp/cb',
    });
    const consent = new Request('https://a/api/auth/oauth2/consent', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        accept: true,
        oauth_query:
          'client_id=c3&redirect_uri=http%3A%2F%2Flocalhost%3A1%2Fcb&sig=x',
      }),
    });
    expect(await readOnboardingParams(consent, 'consent')).toEqual({
      clientId: 'c3',
      redirectUri: 'http://localhost:1/cb',
    });
  });

  it('reads the error code from a JSON error or an app redirect, nothing else', async () => {
    expect(
      await readErrorCode(
        new Response(
          JSON.stringify({ error: 'invalid_grant', error_description: 'x' }),
          {
            status: 400,
          },
        ),
      ),
    ).toBe('invalid_grant');
    expect(
      await readErrorCode(
        new Response(null, {
          status: 302,
          headers: {
            location: 'https://x.example/cb?error=access_denied&state=s',
          },
        }),
      ),
    ).toBe('access_denied');
    expect(await readErrorCode(new Response('{}', { status: 200 }))).toBe('');
  });

  it('client kind comes from the stored row; unknown when absent or on a database error', async () => {
    const pool = (rows: unknown[] | Error) => ({
      query: async () => {
        if (rows instanceof Error) throw rows;
        return { rows };
      },
    });
    expect(
      await clientKindOf(
        pool([
          { clientDiscoveryId: null, registration: 'registered' },
        ]) as never,
        'c',
      ),
    ).toBe('registered');
    expect(
      await clientKindOf(
        pool([
          { clientDiscoveryId: 'https://c/doc', registration: null },
        ]) as never,
        'c',
      ),
    ).toBe('cimd');
    expect(await clientKindOf(pool([]) as never, 'c')).toBe('unknown');
    expect(await clientKindOf(pool(new Error('db')) as never, 'c')).toBe(
      'unknown',
    );
    expect(await clientKindOf(undefined, 'c')).toBe('unknown');
  });
});

describe('what reaches the console', () => {
  it('a lookup that never answers does not hold the response back', async () => {
    const pool = { query: () => new Promise(() => undefined) } as never;
    const started = Date.now();
    expect(await clientKindOf(pool, 'c', 30)).toBe('unknown');
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it('a failed dispatch is logged as a server_error step, without the exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const config = {
      enabled: true,
      host: 'auth.localhost:3000',
      corsAllowedOrigins: [],
      dcrEnabled: false,
    } as unknown as AuthServerConfig;
    const handle = createAuthServerHandler(
      () => config,
      () =>
        ({
          auth: {
            handler: async () => {
              throw new Error('boom SECRETTEXT');
            },
          },
        } as never),
    );
    const res = await handle(
      new Request('http://auth.localhost:3000/api/auth/oauth2/token', {
        method: 'POST',
        headers: {
          host: 'auth.localhost:3000',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'client_id=x&redirect_uri=https%3A%2F%2Fa.example%2Fcb&code=SECRETCODE',
      }),
    );
    expect(res.status).toBe(500);
    const lines = log.mock.calls.map((c) => String(c[0]));
    expect(lines).toEqual([
      '[auth-server:onboarding] client_kind=unknown step=token error=server_error redirect_host=a.example',
    ]);
    expect(lines.join()).not.toMatch(/SECRET|boom/);
  });

  it('one line per step with none of the secret material', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    await logOnboardingStep({
      step: 'token',
      requestCopy: new Request('https://a/api/auth/oauth2/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'code=AUTHCODE123&code_verifier=VERIFIER456&client_id=hypha-cursor&redirect_uri=cursor%3A%2F%2Fanysphere.cursor-mcp%2Foauth%2Fcallback%3Fx%3DSECRET',
      }),
      response: new Response(
        JSON.stringify({
          error: 'invalid_grant',
          error_description: 'bad code AUTHCODE123 for person@example.com',
        }),
        { status: 400 },
      ),
      pool: {
        query: async () => ({
          rows: [{ clientDiscoveryId: null, registration: 'registered' }],
        }),
      } as never,
    });
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]![0]);
    expect(line).toBe(
      '[auth-server:onboarding] client_kind=registered step=token error=invalid_grant redirect_host=anysphere.cursor-mcp',
    );
    for (const secret of [
      'AUTHCODE123',
      'VERIFIER456',
      'SECRET',
      '@',
      '/oauth',
    ])
      expect(line).not.toContain(secret);
  });

  it('the handler logs one line per authorize / token step and survives a server with no pool', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const config = {
      enabled: true,
      host: 'auth.localhost:3000',
      corsAllowedOrigins: [],
      dcrEnabled: false,
    } as unknown as AuthServerConfig;
    const handle = createAuthServerHandler(
      () => config,
      () =>
        ({
          auth: { handler: async () => new Response('{}', { status: 200 }) },
        } as never),
    );
    const res = await handle(
      new Request(
        'http://auth.localhost:3000/api/auth/oauth2/authorize?client_id=x&redirect_uri=https%3A%2F%2Fa.example%2Fcb&code_challenge=SECRETCHAL',
        { headers: { host: 'auth.localhost:3000' } },
      ),
    );
    expect(res.status).toBe(200);
    expect(log).toHaveBeenCalledTimes(1);
    const line = String(log.mock.calls[0]![0]);
    expect(line).toBe(
      '[auth-server:onboarding] client_kind=unknown step=authorize error=none redirect_host=a.example',
    );
    expect(line).not.toContain('SECRETCHAL');
  });
});
