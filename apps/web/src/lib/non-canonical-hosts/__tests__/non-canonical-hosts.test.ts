import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
// The matcher Next.js itself uses for `source` (its compiled copy ships no types).
// @ts-expect-error TS7016
import { match } from 'next/dist/compiled/path-to-regexp';

import { config } from '../../../middleware';
import {
  JWKS_PATH,
  NON_CANONICAL_HOST_PATTERN,
  STALE_ALIAS_HOST,
  buildNoindexHeaderRule,
  buildStaleAliasRedirectRule,
} from '../index';

// next-intl cannot load under vitest; only the exported matcher is used here.
vi.mock('@hypha-platform/i18n', () => ({
  middleware: () => new Response(null),
  routing: { locales: ['en', 'pt'], defaultLocale: 'en' },
}));

const CANONICAL = 'app.hypha.earth';

/** Next.js compiles a `has` host value as `^value$`. */
const hostMatches = (pattern: string, host: string) =>
  new RegExp(`^${pattern}$`).test(host);

const noindexRule = buildNoindexHeaderRule(undefined);
const redirectRule = buildStaleAliasRedirectRule(undefined);
const hostValue = (rule: { has?: { type: string; value?: string }[] }) =>
  rule.has?.find((h) => h.type === 'host')?.value ?? '';

/** Where Next.js would send `pathname` under the redirect rule, or null. */
const redirectTarget = (pathname: string, search = ''): string | null => {
  const matched = match(redirectRule.source, { decode: decodeURIComponent })(
    pathname,
  );
  if (!matched) return null;
  // `:path` is substituted verbatim into the destination.
  const { path: rest = '' } = matched.params as { path?: string };
  const target = redirectRule.destination.replace(':path', rest);
  return `${target}${search}`;
};

describe('non-canonical hosts: noindex rule', () => {
  const noindexed = [
    'pr-2718.preview-app.hypha.earth',
    'pr-1.preview-app.hypha.earth',
    'preview-app.hypha.earth',
    'hypha-web-three.vercel.app',
    'hypha-abc123-hypha-dao.vercel.app',
    'hypha-git-some-branch-hypha-dao.vercel.app',
  ];
  const never = [
    CANONICAL,
    'www.hypha.earth',
    'hypha.earth',
    'preview-app.hypha.earth.evil.com',
    'xpreview-app.hypha.earth',
    'pr-abc.preview-app.hypha.earth',
    'app.hypha.earth.vercel.app.evil.com',
    'vercel.app',
    'client.example.org',
    'localhost',
  ];

  it.each(noindexed)('%s gets noindex', (host) => {
    expect(hostMatches(hostValue(noindexRule), host)).toBe(true);
  });

  it.each(never)('%s never gets noindex', (host) => {
    expect(hostMatches(hostValue(noindexRule), host)).toBe(false);
  });

  it('sends X-Robots-Tag noindex on every path', () => {
    expect(noindexRule.source).toBe('/:path*');
    expect(noindexRule.headers).toEqual([
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ]);
  });

  it('is skipped for mapped hosts through `missing`', () => {
    const mapped = [
      { type: 'host' as const, value: '(client\\.example\\.org)' },
    ];
    expect(buildNoindexHeaderRule(mapped).missing).toEqual(mapped);
    expect(buildStaleAliasRedirectRule(mapped).missing).toEqual(mapped);
  });

  it('exports the pattern used by the rule', () => {
    expect(hostValue(noindexRule)).toBe(NON_CANONICAL_HOST_PATTERN);
  });
});

describe('non-canonical hosts: stale alias redirect', () => {
  it('only applies to the alias host', () => {
    const value = hostValue(redirectRule);
    expect(hostMatches(value, STALE_ALIAS_HOST)).toBe(true);
    for (const host of [
      CANONICAL,
      'hypha-abc123-hypha-dao.vercel.app', // deployment URL: crons call it via VERCEL_URL
      'hypha-web-three.vercel.app.evil.com',
      'xhypha-web-three.vercel.app',
      'preview-app.hypha.earth',
      'pr-2718.preview-app.hypha.earth',
      'client.example.org',
    ]) {
      expect(hostMatches(value, host)).toBe(false);
    }
  });

  it('is permanent (308)', () => {
    expect(redirectRule.permanent).toBe(true);
  });

  it('never redirects the JWKS path (Neon does not follow redirects)', () => {
    expect(redirectTarget(JWKS_PATH)).toBeNull();
    // A query string is not part of the path; the path is still not redirected.
    expect(redirectTarget('/.well-known/jwks.json')).toBeNull();
  });

  it.each([
    ['/', '/'],
    ['/en/network', '/en/network'],
    ['/en/dho/some-space/overview', '/en/dho/some-space/overview'],
    ['/api/v1/spaces', '/api/v1/spaces'],
    ['/robots.txt', '/robots.txt'],
    [
      '/.well-known/oauth-authorization-server',
      '/.well-known/oauth-authorization-server',
    ],
    ['/.well-known/jwks.json.bak', '/.well-known/jwks.json.bak'],
    ['/.well-known/jwks.jsonx', '/.well-known/jwks.jsonx'],
    ['/x/.well-known/jwks.json', '/x/.well-known/jwks.json'],
  ])('%s goes to the same path on the canonical host', (from, to) => {
    expect(redirectTarget(from)).toBe(`https://${CANONICAL}${to}`);
  });

  it('keeps the query string (Next.js forwards it)', () => {
    // Next appends the original query to a redirect without its own query.
    expect(redirectRule.destination).not.toContain('?');
    expect(redirectTarget('/en/network', '?a=1&b=2')).toBe(
      `https://${CANONICAL}/en/network?a=1&b=2`,
    );
  });

  it('sends to the canonical host, not to the alias or a preview', () => {
    expect(redirectRule.destination).toBe(`https://${CANONICAL}/:path`);
  });
});

describe('non-canonical hosts: JWKS path stays served', () => {
  const [pattern] = config.matcher;
  const runsMiddleware = (pathname: string) =>
    new RegExp(`^${pattern}$`).test(pathname);

  // The alias is not one of the app's own hosts, so the white-label host check
  // answers a 404 for it. The JWKS URL works there only because the middleware
  // never sees it. Neon fetches this URL on the alias.
  it('the middleware never runs for /.well-known/jwks.json', () => {
    expect(runsMiddleware(JWKS_PATH)).toBe(false);
  });
});

describe('non-canonical hosts: wiring in next.config.ts', () => {
  const nextConfig = readFileSync(
    path.resolve(__dirname, '../../../../next.config.ts'),
    'utf8',
  );

  it('registers both rules', () => {
    expect(nextConfig).toContain('buildNoindexHeaderRule(NOT_MAPPED_HOST)');
    expect(nextConfig).toContain(
      'buildStaleAliasRedirectRule(NOT_MAPPED_HOST)',
    );
  });

  it('puts the alias redirect before the other redirects', () => {
    const redirects = nextConfig.slice(nextConfig.indexOf('redirects: async'));
    expect(redirects.indexOf('buildStaleAliasRedirectRule')).toBeLessThan(
      redirects.indexOf("source: '/'"),
    );
  });
});

describe('JWKS route cache header', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('is CDN-cacheable for a few minutes, with stale-while-revalidate', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'app-id');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [{ kid: 'k1' }] })),
    );
    const { GET } = await import('../../../app/.well-known/jwks.json/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=300, stale-while-revalidate=600',
    );
  });

  it('caches a response without optional keys for 30 s only, never stale', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'app-id');
    vi.stubEnv('PRIVY_EXTRA_JWKS_APP_IDS', 'extra-app');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('extra-app')
          ? new Response('x', { status: 500 })
          : Response.json({ keys: [{ kid: 'k1' }] }),
      ),
    );
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { GET } = await import('../../../app/.well-known/jwks.json/route');
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('public, s-maxage=30');
  });

  it('uses the long window when every optional fetch succeeds', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'app-id');
    vi.stubEnv('PRIVY_EXTRA_JWKS_APP_IDS', 'extra-app');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [{ kid: 'k1' }] })),
    );
    const { GET } = await import('../../../app/.well-known/jwks.json/route');
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toBe(
      'public, s-maxage=300, stale-while-revalidate=600',
    );
  });

  it('does not cache a failure', async () => {
    vi.stubEnv('NEXT_PUBLIC_PRIVY_APP_ID', 'app-id');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('x', { status: 500 })),
    );
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { GET } = await import('../../../app/.well-known/jwks.json/route');
    const res = await GET();
    expect(res.status).toBe(500);
    expect(res.headers.get('Cache-Control')).toBeNull();
  });
});
