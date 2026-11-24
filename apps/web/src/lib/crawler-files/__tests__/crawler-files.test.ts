import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { config } from '../../../middleware';

// next-intl cannot load under vitest; only the exported matcher is used here.
vi.mock('@hypha-platform/i18n', () => ({
  middleware: () => new Response(null),
  routing: { locales: ['en', 'pt'], defaultLocale: 'en' },
}));

const webRoot = path.resolve(__dirname, '../../../..');
const read = (file: string) => readFileSync(path.join(webRoot, file), 'utf8');

/** The crawler files served as static files, with no function run (#2696). */
const CRAWLER_FILES = ['robots.txt', 'sitemap.xml', 'llms.txt'];

/** Next.js anchors a matcher: the whole path must match it. */
const matcherRegex = (): RegExp => {
  const [pattern] = config.matcher;
  return new RegExp(`^${pattern}$`);
};
const runsMiddleware = (pathname: string) => matcherRegex().test(pathname);

describe('crawler files: middleware matcher', () => {
  it.each(CRAWLER_FILES)('/%s skips the middleware', (file) => {
    expect(runsMiddleware(`/${file}`)).toBe(false);
  });

  it.each([
    '/',
    '/en/network',
    '/en/dho/some-space/overview',
    '/api/v1/spaces',
    '/api/auth/callback',
    '/embed/some-space/en/overview',
    '/robots',
    '/en/robots.txt',
  ])('%s is unchanged (middleware still runs where it did)', (pathname) => {
    // `/api/auth/` is skipped today; everything else here goes through it.
    const expected = !pathname.startsWith('/api/auth/');
    expect(runsMiddleware(pathname)).toBe(expected);
  });

  it.each([
    '/.well-known/jwks.json',
    '/icon/favicon.ico',
    '/mcp',
    '/_next/static/chunk.js',
  ])('%s keeps skipping the middleware', (pathname) => {
    expect(runsMiddleware(pathname)).toBe(false);
  });
});

describe('crawler files: static rule prefixes', () => {
  it('next.config skips the same names as the matcher (keep in step)', () => {
    const nextConfig = read('next.config.ts');
    const prefixes = nextConfig.slice(
      nextConfig.indexOf('const MIDDLEWARE_SKIPPED_PREFIXES'),
      nextConfig.indexOf("].join('|')"),
    );
    for (const file of CRAWLER_FILES) {
      expect(prefixes).toContain(`'${file}'`);
    }
  });
});

describe('crawler files: public folder', () => {
  it.each(CRAWLER_FILES)('public/%s exists and is not empty', (file) => {
    const target = path.join(webRoot, 'public', file);
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target, 'utf8').trim().length).toBeGreaterThan(0);
  });

  it('robots.txt allows crawling, blocks /api/ and points to the sitemap', () => {
    const robots = read('public/robots.txt');
    expect(robots).toMatch(/^User-agent: \*$/m);
    expect(robots).toMatch(/^Disallow: \/api\/$/m);
    expect(robots).toMatch(
      /^Sitemap: https:\/\/app\.hypha\.earth\/sitemap\.xml$/m,
    );
    // Only /api/ is named: robots.txt is public and is not access control.
    expect(robots.match(/^Disallow:/gm)).toHaveLength(1);
  });

  it('sitemap.xml lists only absolute URLs on the canonical host', () => {
    const sitemap = read('public/sitemap.xml');
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^https:\/\/app\.hypha\.earth\/en\//);
    }
  });
});
