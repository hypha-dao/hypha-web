import { describe, expect, it } from 'vitest';
import {
  WL_REQUEST_HEADERS,
  buildFrameAncestors,
  classifyLink,
  embedFraming,
  localeForPath,
  negotiateLocale,
  normaliseFramingOrigin,
  parseWhiteLabelConfig,
  resolve,
  sectionHref,
  splitPath,
  stripWhiteLabelHeaders,
  type ResolveOptions,
  type WhiteLabelConfig,
} from '..';

const OPTIONS: ResolveOptions = {
  locales: ['en', 'pt', 'es', 'fr', 'de', 'mk', 'nl', 'no'],
  defaultLocale: 'en',
};

const CONFIG: WhiteLabelConfig = {
  hostClients: [],
  mainHosts: [],
  clients: [
    {
      id: 'client-a',
      spaces: [
        {
          slug: 'space-one',
          framingOrigins: ['https://partner-a.example'],
        },
      ],
    },
    {
      id: 'client-b',
      spaces: [
        {
          slug: 'space-one',
          framingOrigins: [
            'https://partner-b.example',
            'https://partner-a.example',
          ],
        },
        { slug: 'en', framingOrigins: ['https://partner-b.example:8443'] },
      ],
    },
  ],
};

const run = (path: string, config = CONFIG) =>
  resolve('app.example', path, config, OPTIONS);

describe('resolve: feature off', () => {
  it.each([
    ['empty clients', { clients: [], hostClients: [], mainHosts: [] }],
    ['parsed from unset env', parseWhiteLabelConfig(undefined)],
    ['parsed from empty env', parseWhiteLabelConfig('')],
    ['parsed from garbage', parseWhiteLabelConfig('{nope')],
  ])('passes everything through (%s)', (_name, config) => {
    expect(run('/embed/space-one', config)).toEqual({ kind: 'pass' });
    expect(run('/embed', config)).toEqual({ kind: 'pass' });
    expect(run('/en/network', config)).toEqual({ kind: 'pass' });
    expect(run('/wl/space-one/en/overview', config)).toEqual({ kind: 'pass' });
  });
});

describe('resolve: pass through for the main app', () => {
  it.each(['/', '/en/network', '/en/dho/space-one/overview', '/embedded'])(
    '%s',
    (path) => {
      expect(run(path)).toEqual({ kind: 'pass' });
    },
  );
});

describe('resolve: approved and unapproved slugs', () => {
  it('rewrites an approved slug to the internal tree (landing = overview)', () => {
    expect(run('/embed/space-one')).toMatchObject({
      kind: 'rewrite',
      pathname: '/wl/space-one/en/overview',
      spaceSlug: 'space-one',
      locale: 'en',
    });
  });

  it('keeps the section and an optional trailing slash', () => {
    expect(run('/embed/space-one/agreements')).toMatchObject({
      kind: 'rewrite',
      pathname: '/wl/space-one/en/agreements',
    });
    expect(run('/embed/space-one/agreements/')).toMatchObject({
      kind: 'rewrite',
      pathname: '/wl/space-one/en/agreements',
    });
  });

  it.each(['/embed/other-space', '/embed/Space-One', '/embed/space-one-x'])(
    'unapproved slug %s is not found',
    (path) => {
      expect(run(path)).toEqual({
        kind: 'not-found',
        reason: 'unapproved-space',
      });
    },
  );

  it('bare /embed has no Space', () => {
    expect(run('/embed')).toEqual({
      kind: 'not-found',
      reason: 'unapproved-space',
    });
    expect(run('/embed/')).toEqual({
      kind: 'not-found',
      reason: 'unapproved-space',
    });
  });

  it('the host is accepted and not used', () => {
    const a = resolve('a.example', '/embed/space-one', CONFIG, OPTIONS);
    const b = resolve(null, '/embed/space-one', CONFIG, OPTIONS);
    expect(a).toEqual(b);
  });

  it('forwards unknown deeper paths to the tree (its catch-all 404s)', () => {
    expect(run('/embed/space-one/does-not-exist')).toMatchObject({
      kind: 'rewrite',
      pathname: '/wl/space-one/en/does-not-exist',
    });
  });
});

describe('resolve: internal prefix and odd paths', () => {
  it.each([
    '/wl',
    '/wl/space-one',
    '/wl/space-one/en/overview',
    '/WL/space-one/en/overview',
    '/%77l/space-one/en/overview',
    '/%57L/space-one/en/overview',
  ])('direct %s is not found', (path) => {
    expect(run(path)).toEqual({
      kind: 'not-found',
      reason: 'internal-prefix',
    });
  });

  it.each([
    '/embed//space-one',
    '/embed/space-one//agreements',
    '/embed/./space-one',
    '/embed/space-one/../other',
    '/embed/space-one/%2e%2e/other',
    '/embed/space-one/%2E%2E/agreements',
    '/embed/space-one%2Fagreements',
    '/embed/space-one%5Cagreements',
    '/embed/space-one/agree%00ments',
    '/embed/space-one/%zz',
    '/Embed/space-one',
    '/%65mbed/space-one',
  ])('malformed or traversal path %s never rewrites', (path) => {
    const decision = run(path);
    expect(decision.kind).toBe('not-found');
  });

  it('never produces a rewrite target outside /wl/<slug>/<locale>/', () => {
    for (const path of [
      '/embed/space-one/..%2f..%2fapi',
      '/embed/space-one/agreements/..%2f..',
      '/embed/space-one/a%2fb',
    ]) {
      const decision = run(path);
      if (decision.kind === 'rewrite') {
        expect(decision.pathname.startsWith('/wl/space-one/en/')).toBe(true);
        expect(decision.pathname).not.toMatch(/\.\.|%2f/i);
      }
    }
  });

  it('the app api is not served under /embed', () => {
    expect(run('/embed/space-one/api/v1/spaces')).toEqual({
      kind: 'not-found',
      reason: 'api-not-served',
    });
    expect(run('/embed/space-one/pt/api/v1/spaces')).toEqual({
      kind: 'not-found',
      reason: 'api-not-served',
    });
  });
});

describe('resolve: locale and section-name collisions', () => {
  it('a locale segment after the slug sets the locale', () => {
    expect(run('/embed/space-one/pt/agreements')).toMatchObject({
      kind: 'rewrite',
      pathname: '/wl/space-one/pt/agreements',
      locale: 'pt',
    });
    expect(run('/embed/space-one/de')).toMatchObject({
      pathname: '/wl/space-one/de/overview',
      locale: 'de',
    });
  });

  it('an unknown locale is a path segment, not a locale', () => {
    expect(run('/embed/space-one/xx/agreements')).toMatchObject({
      pathname: '/wl/space-one/en/xx/agreements',
      locale: 'en',
    });
  });

  it('a slug equal to a locale code is the slug (first segment wins)', () => {
    expect(run('/embed/en')).toMatchObject({
      kind: 'rewrite',
      spaceSlug: 'en',
      pathname: '/wl/en/en/overview',
    });
    expect(run('/embed/en/pt/members')).toMatchObject({
      spaceSlug: 'en',
      locale: 'pt',
      pathname: '/wl/en/pt/members',
    });
  });

  it('section names and locale codes are disjoint', () => {
    const sections = [
      'overview',
      'agreements',
      'banking',
      'calendar',
      'coherence',
      'ecosystem-navigation',
      'energy',
      'members',
      'memory',
      'pipeline',
      'rewards',
      'treasury',
    ];
    for (const section of sections) {
      expect(OPTIONS.locales).not.toContain(section);
    }
  });
});

describe('resolve: framing origins per Space', () => {
  it('is the union over clients approving the Space, without duplicates', () => {
    const decision = run('/embed/space-one');
    expect(decision.kind).toBe('rewrite');
    if (decision.kind !== 'rewrite') return;
    expect(decision.clientIds).toEqual(['client-a', 'client-b']);
    expect(decision.framingOrigins).toEqual([
      'https://partner-a.example',
      'https://partner-b.example',
    ]);
  });

  it('does not leak origins between Spaces', () => {
    const decision = run('/embed/en');
    expect(decision.kind).toBe('rewrite');
    if (decision.kind !== 'rewrite') return;
    expect(decision.clientIds).toEqual(['client-b']);
    expect(decision.framingOrigins).toEqual(['https://partner-b.example:8443']);
  });
});

describe('config parsing', () => {
  it('parses the registry-shaped record', () => {
    const config = parseWhiteLabelConfig(
      JSON.stringify([
        {
          id: 'example-client',
          spaces: [
            {
              slug: 'example-space',
              framingOrigins: ['https://partner.example/'],
            },
          ],
        },
      ]),
    );
    expect(config.clients).toEqual([
      {
        id: 'example-client',
        spaces: [
          {
            slug: 'example-space',
            framingOrigins: ['https://partner.example'],
          },
        ],
      },
    ]);
  });

  it('drops a Space with no valid framing origin (fail closed)', () => {
    const config = parseWhiteLabelConfig(
      JSON.stringify([
        {
          id: 'c',
          spaces: [
            { slug: 'bad', framingOrigins: ['*', 'http://partner.example'] },
          ],
        },
      ]),
    );
    expect(config.clients).toEqual([]);
  });

  it('drops invalid slugs and client ids', () => {
    const config = parseWhiteLabelConfig(
      JSON.stringify([
        {
          id: 'Bad Id',
          spaces: [{ slug: 'ok', framingOrigins: ['https://a.example'] }],
        },
        {
          id: 'ok',
          spaces: [
            { slug: 'Bad_Slug', framingOrigins: ['https://a.example'] },
            { slug: '../x', framingOrigins: ['https://a.example'] },
            { slug: 'fine', framingOrigins: ['https://a.example'] },
          ],
        },
      ]),
    );
    expect(config.clients).toHaveLength(1);
    expect(config.clients[0]?.spaces.map((s) => s.slug)).toEqual(['fine']);
  });

  it.each([
    ['https://partner.example', 'https://partner.example'],
    ['https://partner.example:8443', 'https://partner.example:8443'],
    ['http://localhost:4000', 'http://localhost:4000'],
    ['http://127.0.0.1:4000', 'http://127.0.0.1:4000'],
  ])('accepts origin %s', (input, expected) => {
    expect(normaliseFramingOrigin(input)).toBe(expected);
  });

  it.each([
    '*',
    'https://*.example',
    'http://partner.example',
    'https://partner.example/path',
    'https://partner.example?x=1',
    'https://user:pw@partner.example',
    "https://partner.example; script-src 'unsafe-inline'",
    "https://partner.example 'self'",
    'https://a.example,https://b.example',
    'partner.example',
    'javascript:alert(1)',
    '',
    42,
    null,
  ])('rejects origin %j', (input) => {
    expect(normaliseFramingOrigin(input)).toBeNull();
  });
});

describe('header stripping and framing policy', () => {
  it('removes incoming copies of every white-label header', () => {
    const incoming = new Headers({
      accept: 'text/html',
      'X-Hypha-WL-Space': 'forged',
      'x-hypha-wl-mode': 'forged',
      'x-hypha-wl-not-found': 'forged',
    });
    const stripped = stripWhiteLabelHeaders(incoming);
    for (const name of WL_REQUEST_HEADERS) {
      expect(stripped.has(name)).toBe(false);
    }
    expect(stripped.get('accept')).toBe('text/html');
    // the input is not mutated
    expect(incoming.has('x-hypha-wl-space')).toBe(true);
  });

  it('frame-ancestors lists the Space origins, otherwise none', () => {
    expect(
      buildFrameAncestors(['https://a.example', 'https://b.example']),
    ).toBe('https://a.example https://b.example');
    expect(buildFrameAncestors([])).toBe("'none'");
  });

  it('embed framing sends no X-Frame-Options; empty origins stay closed', () => {
    expect(embedFraming(['https://a.example'])).toEqual({
      xFrameOptions: null,
      frameAncestors: 'https://a.example',
    });
    expect(embedFraming([])).toEqual({
      xFrameOptions: 'DENY',
      frameAncestors: "'none'",
    });
  });
});

describe('splitPath', () => {
  it('decodes segments and tolerates one trailing slash', () => {
    expect(splitPath('/embed/space-one/')).toEqual(['embed', 'space-one']);
    expect(splitPath('/a%20b/c')).toEqual(['a b', 'c']);
  });
  it('rejects non-absolute and empty inner segments', () => {
    expect(splitPath('embed')).toBeNull();
    expect(splitPath('/a//b')).toBeNull();
    expect(splitPath('/a/./b')).toBeNull();
  });
});

describe('link classification', () => {
  const ctx = { mode: 'embed', spaceSlug: 'space-one', lang: 'en' } as const;
  const app = 'https://app.example';

  it('builds section hrefs under /embed', () => {
    expect(sectionHref(ctx, 'members')).toBe('/embed/space-one/en/members');
  });

  it('keeps links to this Space inside the embed', () => {
    expect(classifyLink('/en/dho/space-one/agreements', ctx, app)).toEqual({
      kind: 'internal',
      href: '/embed/space-one/en/agreements',
    });
    expect(classifyLink('/pt/dho/space-one', ctx, app)).toEqual({
      kind: 'internal',
      href: '/embed/space-one/en/overview',
    });
  });

  it('sends person pages, proposals, other Spaces and create flows to the full app', () => {
    for (const href of [
      '/en/dho/space-one/members/person/jane',
      '/en/dho/space-one/agreements/proposal/p1',
      '/en/dho/space-one/agreements/create/pay-for-expenses',
      '/en/dho/other-space/overview',
      '/en/profile/jane',
      '/en/network',
    ]) {
      expect(classifyLink(href, ctx, app)?.kind).toBe('external');
    }
  });

  it('other origins are external; mailto and hash are left alone', () => {
    expect(classifyLink('https://other.example/x', ctx, app)).toEqual({
      kind: 'external',
      href: 'https://other.example/x',
    });
    expect(classifyLink('mailto:a@b.example', ctx, app)).toBeNull();
    expect(classifyLink('#top', ctx, app)).toBeNull();
    expect(classifyLink('', ctx, app)).toBeNull();
  });
});

describe('locale negotiation (no locale in the path)', () => {
  const withLang = (acceptLanguage: string | null, path = '/embed/space-one') =>
    resolve('h', path, CONFIG, { ...OPTIONS, acceptLanguage });

  it('uses the browser language, ignoring region', () => {
    expect(withLang('pt-BR,pt;q=0.9,en;q=0.5')).toMatchObject({
      locale: 'pt',
      pathname: '/wl/space-one/pt/overview',
    });
  });

  it('honours q-values and skips unsupported languages', () => {
    expect(negotiateLocale('ja,fr;q=0.8,de;q=0.9', OPTIONS.locales)).toBe('de');
    expect(negotiateLocale('ja,zh;q=0.9', OPTIONS.locales)).toBeNull();
  });

  it('maps nb and nn to no; ignores * and q=0', () => {
    expect(negotiateLocale('nb-NO', OPTIONS.locales)).toBe('no');
    expect(negotiateLocale('*', OPTIONS.locales)).toBeNull();
    expect(negotiateLocale('fr;q=0,es;q=0.1', OPTIONS.locales)).toBe('es');
  });

  it('falls back to the default for missing or junk headers', () => {
    expect(withLang(null)).toMatchObject({ locale: 'en' });
    expect(withLang('')).toMatchObject({ locale: 'en' });
    expect(withLang(';;;,q=')).toMatchObject({ locale: 'en' });
  });

  it('a locale in the path wins over the header', () => {
    expect(withLang('pt', '/embed/space-one/de/members')).toMatchObject({
      locale: 'de',
      pathname: '/wl/space-one/de/members',
    });
  });
});

describe('review follow-ups', () => {
  it('a link to another Space embed opens outside the frame', () => {
    const ctx = { mode: 'embed', spaceSlug: 'space-one', lang: 'en' } as const;
    expect(
      classifyLink('/embed/space-one/en/members', ctx, 'https://app.example'),
    ).toEqual({
      kind: 'internal',
      href: '/embed/space-one/en/members',
    });
    expect(
      classifyLink('/embed/other-space/en/members', ctx, 'https://app.example')
        ?.kind,
    ).toBe('external');
  });

  it('merges origins from repeated records of one Space in one client', () => {
    const config: WhiteLabelConfig = {
      hostClients: [],
      mainHosts: [],
      clients: [
        {
          id: 'client-a',
          spaces: [
            { slug: 'space-one', framingOrigins: ['https://a.example'] },
            { slug: 'space-one', framingOrigins: ['https://b.example'] },
          ],
        },
      ],
    };
    const decision = resolve('h', '/embed/space-one', config, OPTIONS);
    expect(decision).toMatchObject({
      kind: 'rewrite',
      clientIds: ['client-a'],
      framingOrigins: ['https://a.example', 'https://b.example'],
    });
  });

  it('accepts a differently cased host, rejects other odd spellings', () => {
    expect(normaliseFramingOrigin('https://Partner.Example')).toBe(
      'https://partner.example',
    );
    expect(normaliseFramingOrigin('https://partner.example:443')).toBeNull();
    expect(normaliseFramingOrigin('https:partner.example')).toBeNull();
    expect(normaliseFramingOrigin('https://partner.example/a/..')).toBeNull();
  });

  it('picks the locale of an unserved /embed path', () => {
    const options = { ...OPTIONS, acceptLanguage: 'de' };
    expect(localeForPath('/embed/unknown/pt/overview', options)).toBe('pt');
    expect(localeForPath('/embed/unknown/overview', options)).toBe('de');
    expect(localeForPath('/embed/unknown', { ...OPTIONS })).toBe('en');
  });
});
