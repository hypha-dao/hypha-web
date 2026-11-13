import { describe, expect, it } from 'vitest';
import {
  WL_API_READ_ALLOWLIST,
  WL_API_SIGNED_IN_READ_ALLOWLIST,
  apiAllowlistFor,
  resolve,
  stripWhiteLabelHeaders,
  WL_SPACE_HEADER,
  type WhiteLabelConfig,
  type ResolveOptions,
  authKindFor,
  isApiReadAllowed,
  parseAuthConfig,
  privyHostOrigins,
  readAuthConfigHeader,
  serializeAuthConfig,
  withPrivyHostOrigins,
} from '..';

const AUTH = { privyClientId: 'client-abc123', cookieDomain: 'a.example.test' };
const OTHER = {
  privyClientId: 'client-xyz789',
  cookieDomain: 'b.example.test',
};

describe('auth provider by mode', () => {
  it('mounts Privy only on a mapped host with login settings', () => {
    expect(authKindFor('host', AUTH)).toBe('privy');
  });

  it('stays anonymous on a host without login settings', () => {
    expect(authKindFor('host', null)).toBe('anonymous');
  });

  it('never mounts Privy in the iframe, even if login settings reach it', () => {
    expect(authKindFor('embed', null)).toBe('anonymous');
    expect(authKindFor('embed', AUTH)).toBe('anonymous');
  });
});

describe('login settings validation', () => {
  it('round-trips through the request header', () => {
    expect(readAuthConfigHeader(serializeAuthConfig(AUTH))).toEqual(AUTH);
  });

  it('reads a missing, malformed or odd header as "no login settings"', () => {
    for (const raw of [
      null,
      undefined,
      '',
      'not json',
      '[]',
      '{}',
      JSON.stringify({ privyClientId: 'ok', cookieDomain: 'a.test:8080' }),
      JSON.stringify({ privyClientId: 'has space', cookieDomain: 'a.test' }),
      JSON.stringify({
        privyClientId: 'x'.repeat(129),
        cookieDomain: 'a.test',
      }),
      JSON.stringify({ privyClientId: 'ok', cookieDomain: 'https://a.test' }),
      JSON.stringify({ privyClientId: 5, cookieDomain: 'a.test' }),
    ]) {
      expect(readAuthConfigHeader(raw)).toBeNull();
    }
  });

  it('config: the cookie domain must be the host or a parent of it', () => {
    expect(parseAuthConfig(AUTH, 'a.example.test')).toEqual(AUTH);
    expect(parseAuthConfig(AUTH, 'www.a.example.test')).toEqual(AUTH);
    expect(parseAuthConfig(AUTH, 'b.example.test')).toBeNull();
    expect(parseAuthConfig(AUTH, 'xa.example.test')).toBeNull();
  });
});

describe('/api allowlist: signed-in reads, on the real allowlist', () => {
  // Login on: the host's allowlist includes the signed-in list.
  const allowed = (method: string, path: string, slug = 'hypha-platform') =>
    isApiReadAllowed(
      method,
      path.split('/').filter(Boolean),
      slug,
      apiAllowlistFor(true),
    );

  it('allows the profile, the four Banking listings, the signal workflow and the organisation, GET and HEAD only', () => {
    for (const path of [
      '/api/v1/people/me',
      '/api/v1/spaces/hypha-platform/banking/bank-customers',
      '/api/v1/spaces/hypha-platform/banking/accounts',
      '/api/v1/spaces/hypha-platform/banking/payout-accounts',
      '/api/v1/spaces/hypha-platform/banking/transfers',
      '/api/v1/spaces/hypha-platform/signal-workflow',
      '/api/v1/spaces/hypha-platform/organisation',
    ]) {
      expect(allowed('GET', path)).toBe(true);
      expect(allowed('HEAD', path)).toBe(true);
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(allowed(method, path)).toBe(false);
      }
    }
  });

  it('Banking stays on the own Space: another slug is refused', () => {
    expect(allowed('GET', '/api/v1/spaces/other-space/banking/transfers')).toBe(
      false,
    );
    expect(
      isApiReadAllowed(
        'GET',
        ['api', 'v1', 'spaces', 'hypha-platform', 'banking', 'accounts'],
        undefined,
      ),
    ).toBe(false);
  });

  it('keeps everything else of the signed-in surface refused', () => {
    for (const path of [
      '/api/matrix/token',
      '/api/v1/people/me/intelligence',
      '/api/v1/people/me/message-inbox-context',
      '/api/v1/people/some-person/spaces',
      '/api/v1/people/some-person/assets',
      '/api/v1/people/by-web3-address/0xabc',
      '/api/v1/people/search',
      '/api/v1/spaces/hypha-platform/context',
      '/api/v1/spaces/hypha-platform/banking',
      '/api/v1/spaces/hypha-platform/banking/sync',
      '/api/v1/spaces/hypha-platform/banking/rails-config',
      '/api/v1/spaces/hypha-platform/banking/endorsement-kyc',
      '/api/v1/spaces/hypha-platform/wallet-transferable-tokens',
      '/api/v1/spaces/create',
      '/api/v2/spaces',
    ]) {
      expect(allowed('GET', path)).toBe(false);
    }
  });

  it('no entry is a write path and all stay under /api/v1', () => {
    for (const pattern of [
      ...WL_API_READ_ALLOWLIST,
      ...WL_API_SIGNED_IN_READ_ALLOWLIST,
    ]) {
      expect(pattern.startsWith('/api/v1/')).toBe(true);
      expect(pattern).not.toMatch(/\/(create|update|sync|propose)\b/);
    }
  });
});

describe('CSP per host', () => {
  const BASE =
    "default-src 'self';" +
    "form-action 'self' https://auth.privy.io https://privy.main.test;" +
    "frame-ancestors 'none';" +
    'child-src https://auth.privy.io https://privy.main.test;' +
    'frame-src https://auth.privy.io https://privy.main.test https://challenges.cloudflare.com;' +
    "connect-src 'self' https://auth.privy.io https://privy.main.test;" +
    "script-src 'self' https://challenges.cloudflare.com;";

  const directive = (csp: string, name: string) =>
    csp
      .split(';')
      .map((d) => d.trim())
      .find((d) => d.startsWith(`${name} `)) ?? '';

  it("adds the host's own privy.<cookie domain> to the four directives", () => {
    const origins = privyHostOrigins(AUTH);
    expect(origins).toEqual(['https://privy.a.example.test']);
    const csp = withPrivyHostOrigins(BASE, origins);
    for (const name of [
      'connect-src',
      'frame-src',
      'child-src',
      'form-action',
    ]) {
      expect(directive(csp, name)).toContain('https://privy.a.example.test');
      expect(directive(csp, name)).toContain('https://auth.privy.io');
    }
  });

  it('touches nothing else and adds no wildcard', () => {
    const csp = withPrivyHostOrigins(BASE, privyHostOrigins(AUTH));
    expect(directive(csp, 'script-src')).toBe(directive(BASE, 'script-src'));
    expect(directive(csp, 'default-src')).toBe(directive(BASE, 'default-src'));
    expect(csp).not.toMatch(/\*/);
    expect(csp.replace(/ https:\/\/privy\.a\.example\.test/g, '')).toBe(BASE);
  });

  it('is per host: another host never sees this host', () => {
    const a = withPrivyHostOrigins(BASE, privyHostOrigins(AUTH));
    const b = withPrivyHostOrigins(BASE, privyHostOrigins(OTHER));
    expect(a).not.toContain('privy.b.example.test');
    expect(b).not.toContain('privy.a.example.test');
  });

  it('is unchanged without login settings (and for the iframe)', () => {
    expect(privyHostOrigins(null)).toEqual([]);
    expect(privyHostOrigins(undefined)).toEqual([]);
    expect(withPrivyHostOrigins(BASE, [])).toBe(BASE);
  });

  it('ignores anything that is not an exact https origin', () => {
    for (const bad of [
      'https://*.a.example.test',
      'http://privy.a.example.test',
      'https://privy.a.example.test/path',
      'https://a.test; script-src *',
      "'unsafe-inline'",
    ]) {
      expect(withPrivyHostOrigins(BASE, [bad])).toBe(BASE);
    }
  });

  it('does not repeat an origin already present', () => {
    expect(withPrivyHostOrigins(BASE, ['https://privy.main.test'])).toBe(BASE);
  });
});

describe('login is an option of the host: resolver on the real allowlists', () => {
  const OPTIONS: ResolveOptions = {
    locales: ['en'],
    defaultLocale: 'en',
    method: 'GET',
  };
  const CONFIG: WhiteLabelConfig = {
    clients: [
      {
        id: 'embed-client',
        spaces: [
          { slug: 'hypha-platform', framingOrigins: ['https://p.test'] },
        ],
      },
    ],
    hostClients: [
      {
        id: 'host-client',
        hosts: [
          {
            host: 'login.example.test',
            spaceSlug: 'hypha-platform',
            authConfig: AUTH,
          },
          { host: 'readonly.example.test', spaceSlug: 'hypha-platform' },
        ],
      },
    ],
    mainHosts: ['app.example.test'],
  };
  const LOGIN = 'login.example.test';
  const READONLY = 'readonly.example.test';
  const run = (host: string, path: string, method = 'GET') =>
    resolve(host, path, CONFIG, { ...OPTIONS, method });

  const SIGNED_IN = [
    '/api/v1/people/me',
    '/api/v1/spaces/hypha-platform/banking/bank-customers',
    '/api/v1/spaces/hypha-platform/banking/accounts',
    '/api/v1/spaces/hypha-platform/banking/payout-accounts',
    '/api/v1/spaces/hypha-platform/banking/transfers',
    '/api/v1/spaces/hypha-platform/signal-workflow',
    '/api/v1/spaces/hypha-platform/organisation',
  ];
  const BASE = [
    '/api/v1/spaces/hypha-platform',
    '/api/v1/spaces/hypha-platform/members',
    '/api/v1/events',
  ];

  it('a host with login settings reaches the signed-in entries', () => {
    for (const path of SIGNED_IN) {
      expect(run(LOGIN, path)).toEqual({
        kind: 'api-allow',
        spaceSlug: 'hypha-platform',
      });
      expect(run(LOGIN, path, 'HEAD').kind).toBe('api-allow');
      expect(run(LOGIN, path, 'POST').kind).toBe('not-found');
    }
  });

  it('a read-only host refuses them (404) and still serves the base reads', () => {
    for (const path of SIGNED_IN) {
      expect(run(READONLY, path)).toMatchObject({
        kind: 'not-found',
        reason: 'api-not-allowed',
      });
    }
    for (const path of BASE) {
      expect(run(READONLY, path).kind).toBe('api-allow');
      expect(run(LOGIN, path).kind).toBe('api-allow');
    }
  });

  it('the base list holds no signed-in entry', () => {
    for (const pattern of WL_API_SIGNED_IN_READ_ALLOWLIST) {
      expect(WL_API_READ_ALLOWLIST).not.toContain(pattern);
    }
    expect(apiAllowlistFor(false)).toBe(WL_API_READ_ALLOWLIST);
  });

  it('the fact comes from the registration, not from the request', () => {
    // No header, query or cookie can switch it on: the resolver takes none.
    const decision = resolve(READONLY, SIGNED_IN[0] as string, CONFIG, {
      ...OPTIONS,
      acceptLanguage: 'en',
      localeCookie: 'en',
    });
    expect(decision.kind).toBe('not-found');
    // A forged Space header never survives the strip middleware applies.
    const forged = new Headers({ [WL_SPACE_HEADER]: 'other-space' });
    expect(stripWhiteLabelHeaders(forged).get(WL_SPACE_HEADER)).toBeNull();
  });

  it('the iframe (main host) never gets the signed-in entries', () => {
    for (const path of SIGNED_IN) {
      expect(run('app.example.test', path).kind).not.toBe('api-allow');
    }
  });

  it('no sign in/out control and no Privy on a host without login', () => {
    expect(authKindFor('host', null)).toBe('anonymous');
    expect(privyHostOrigins(null)).toEqual([]);
    const csp = withPrivyHostOrigins(
      "connect-src 'self'",
      privyHostOrigins(null),
    );
    expect(csp).toBe("connect-src 'self'");
  });
});
