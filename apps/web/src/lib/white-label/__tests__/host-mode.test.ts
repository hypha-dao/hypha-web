import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  WL_API_READ_ALLOWLIST,
  WL_CLIENT_HEADER,
  WL_MODE_HEADER,
  WL_REQUEST_HEADERS,
  WL_SPACE_HEADER,
  WL_SECTIONS,
  classifyLink,
  getWhiteLabelConfig,
  isApiReadAllowed,
  isMappedHost,
  localeForPath,
  normaliseHost,
  parseAuthConfig,
  parseWhiteLabelConfig,
  parseWhiteLabelHostConfig,
  readAuthConfigHeader,
  resolve,
  sectionFromPathname,
  sectionHref,
  serializeAuthConfig,
  stripWhiteLabelHeaders,
  apiRequestHeaders,
  type ResolveOptions,
  type WhiteLabelConfig,
  type WhiteLabelLinkContext,
} from '..';

const OPTIONS: ResolveOptions = {
  locales: ['en', 'pt', 'es', 'fr', 'de', 'mk', 'nl', 'no'],
  defaultLocale: 'en',
};

const AUTH = {
  privyClientId: 'client-abc123',
  cookieDomain: 'space.partner.example',
};

const CONFIG: WhiteLabelConfig = {
  clients: [
    {
      id: 'embed-client',
      spaces: [
        { slug: 'space-one', framingOrigins: ['https://partner.example'] },
      ],
    },
  ],
  hostClients: [
    {
      id: 'host-client',
      hosts: [
        {
          host: 'space.partner.example',
          spaceSlug: 'space-one',
          authConfig: AUTH,
        },
        { host: 'other.partner.example', spaceSlug: 'space-two' },
      ],
    },
  ],
  mainHosts: ['app.example', 'localhost'],
};

const HOST = 'space.partner.example';
const run = (
  path: string,
  options: Partial<ResolveOptions> = {},
  host: string | null = HOST,
  config = CONFIG,
) => resolve(host, path, config, { ...OPTIONS, ...options });

describe('host mode: routing', () => {
  it('serves the one Space at the root (landing = overview)', () => {
    expect(run('/')).toMatchObject({
      kind: 'rewrite',
      mode: 'host',
      pathname: '/wl/space-one/en/overview',
      clientId: 'host-client',
      clientIds: ['host-client'],
      spaces: ['space-one'],
      spaceSlug: 'space-one',
      locale: 'en',
      localeFromPath: false,
      framingOrigins: [],
      authConfig: AUTH,
    });
  });

  it('rewrites /<section> and /<locale>/<section> to the internal tree', () => {
    expect(run('/agreements')).toMatchObject({
      pathname: '/wl/space-one/en/agreements',
    });
    expect(run('/pt/agreements')).toMatchObject({
      pathname: '/wl/space-one/pt/agreements',
      locale: 'pt',
      localeFromPath: true,
    });
    expect(run('/de')).toMatchObject({
      pathname: '/wl/space-one/de/overview',
      locale: 'de',
    });
    expect(run('/members/')).toMatchObject({
      pathname: '/wl/space-one/en/members',
    });
  });

  it('every served section resolves, with or without a locale', () => {
    for (const section of WL_SECTIONS) {
      expect(run(`/${section}`)).toMatchObject({
        pathname: `/wl/space-one/en/${section}`,
      });
      expect(run(`/fr/${section}`)).toMatchObject({
        pathname: `/wl/space-one/fr/${section}`,
      });
    }
  });

  it('each host serves its own Space; no auth config when none is set', () => {
    const decision = run('/', {}, 'other.partner.example');
    expect(decision).toMatchObject({
      pathname: '/wl/space-two/en/overview',
      spaceSlug: 'space-two',
    });
    expect(decision).not.toHaveProperty('authConfig');
  });

  it('forwards unknown deeper paths to the tree (its catch-all 404s)', () => {
    expect(run('/nope/deeper')).toMatchObject({
      pathname: '/wl/space-one/en/nope/deeper',
    });
  });

  it('matches the host case-insensitively and ignores a trailing dot', () => {
    expect(run('/', {}, 'SPACE.Partner.Example')).toMatchObject({
      mode: 'host',
    });
    expect(run('/', {}, 'space.partner.example.')).toMatchObject({
      mode: 'host',
    });
  });

  it('a Space slug in the path is just a path segment, never a Space switch', () => {
    expect(run('/space-two/overview')).toMatchObject({
      spaceSlug: 'space-one',
      pathname: '/wl/space-one/en/space-two/overview',
    });
  });
});

describe('host mode: collisions', () => {
  it('section names and locale codes are disjoint', () => {
    for (const section of WL_SECTIONS) {
      expect(OPTIONS.locales).not.toContain(section);
    }
  });

  it('the first segment is a locale when it is one, else part of the section path', () => {
    expect(run('/no/treasury')).toMatchObject({
      locale: 'no',
      pathname: '/wl/space-one/no/treasury',
    });
    expect(run('/xx/treasury')).toMatchObject({
      locale: 'en',
      pathname: '/wl/space-one/en/xx/treasury',
    });
  });

  it('the reserved prefixes are never served as pages', () => {
    for (const path of [
      '/wl',
      '/wl/space-one/en/overview',
      '/WL/x',
      '/%77l/x',
    ]) {
      expect(run(path)).toEqual({
        kind: 'not-found',
        reason: 'internal-prefix',
      });
    }
    for (const path of ['/embed', '/embed/space-one', '/Embed/space-one']) {
      expect(run(path)).toEqual({
        kind: 'not-found',
        reason: 'embed-not-served',
      });
    }
  });

  it.each([
    '/agreements//x',
    '/agreements/../x',
    '/agreements/%2e%2e/x',
    '/agreements%2Fx',
    '/agreements/%00',
    '/%zz',
  ])('malformed path %s never rewrites', (path) => {
    expect(run(path)).toEqual({ kind: 'not-found', reason: 'malformed-path' });
  });

  it('never produces a target outside /wl/<slug>/<locale>/', () => {
    for (const path of ['/..%2f..%2fapi', '/a%2fb', '/overview/%2e%2e%2fx']) {
      const decision = run(path);
      if (decision.kind === 'rewrite') {
        expect(decision.pathname.startsWith('/wl/space-one/en/')).toBe(true);
        expect(decision.pathname).not.toMatch(/\.\.|%2f/i);
      }
    }
  });
});

describe('host mode: locale order (path, cookie, Accept-Language, default)', () => {
  it('path wins over cookie and header', () => {
    expect(
      run('/de/members', { localeCookie: 'pt', acceptLanguage: 'fr' }),
    ).toMatchObject({ locale: 'de', localeFromPath: true });
  });

  it('cookie wins over the header', () => {
    expect(
      run('/members', { localeCookie: 'pt', acceptLanguage: 'fr' }),
    ).toMatchObject({
      locale: 'pt',
      localeFromPath: false,
      pathname: '/wl/space-one/pt/members',
    });
  });

  it('an invalid cookie is ignored', () => {
    expect(
      run('/members', { localeCookie: 'xx', acceptLanguage: 'fr' }),
    ).toMatchObject({ locale: 'fr' });
    expect(run('/members', { localeCookie: '../..' })).toMatchObject({
      locale: 'en',
    });
  });

  it('then the browser language, then the default', () => {
    expect(run('/members', { acceptLanguage: 'es-MX,es;q=0.9' })).toMatchObject(
      { locale: 'es' },
    );
    expect(run('/members', { acceptLanguage: 'ja' })).toMatchObject({
      locale: 'en',
    });
    expect(run('/members')).toMatchObject({ locale: 'en' });
  });

  it('the 404 locale on a mapped host follows the same order', () => {
    const options = { ...OPTIONS, localeCookie: 'pt', acceptLanguage: 'de' };
    expect(localeForPath('/de/x', options, true)).toBe('de');
    expect(localeForPath('/x', options, true)).toBe('pt');
    expect(localeForPath('/x', { ...options, localeCookie: null }, true)).toBe(
      'de',
    );
  });
});

describe('host mode: fail closed', () => {
  it('feature off (no hosts, no clients): everything passes', () => {
    const off: WhiteLabelConfig = {
      clients: [],
      hostClients: [],
      mainHosts: [],
    };
    expect(run('/members', {}, HOST, off)).toEqual({ kind: 'pass' });
    expect(run('/api/v1/spaces', {}, 'anything.example', off)).toEqual({
      kind: 'pass',
    });
  });

  it('a host that is neither mapped nor a main host is not served', () => {
    for (const host of [
      'unlisted.partner.example',
      'evil.example',
      'partner.example',
      'sub.space.partner.example',
      'space.partner.example:8443',
      null,
      '',
    ]) {
      expect(run('/members', {}, host)).toEqual({
        kind: 'not-found',
        reason: 'unknown-host',
      });
    }
  });

  it('a local main host matches whatever its port', () => {
    expect(run('/en/network', {}, 'localhost:3000')).toEqual({ kind: 'pass' });
    // Only for hosts in the main list; a non-local host never matches by name.
    expect(run('/en/network', {}, 'app.example:3000')).toEqual({
      kind: 'not-found',
      reason: 'unknown-host',
    });
  });

  it('an unknown host gets no API either', () => {
    expect(run('/api/v1/spaces', {}, 'evil.example')).toEqual({
      kind: 'not-found',
      reason: 'unknown-host',
    });
  });

  it('the main host is unchanged', () => {
    expect(run('/en/network', {}, 'app.example')).toEqual({ kind: 'pass' });
    expect(run('/api/v1/spaces', {}, 'app.example')).toEqual({ kind: 'pass' });
    expect(run('/embed/space-one', {}, 'app.example')).toMatchObject({
      kind: 'rewrite',
      mode: 'embed',
      pathname: '/wl/space-one/en/overview',
    });
    expect(run('/wl/x', {}, 'app.example')).toEqual({
      kind: 'not-found',
      reason: 'internal-prefix',
    });
  });

  it('with only hosts configured, /embed on the main host is not served', () => {
    const hostsOnly: WhiteLabelConfig = { ...CONFIG, clients: [] };
    expect(run('/embed/space-one', {}, 'app.example', hostsOnly)).toEqual({
      kind: 'not-found',
      reason: 'unapproved-space',
    });
    expect(run('/en/network', {}, 'app.example', hostsOnly)).toEqual({
      kind: 'pass',
    });
  });

  it('isMappedHost', () => {
    expect(isMappedHost(CONFIG, 'SPACE.partner.example')).toBe(true);
    expect(isMappedHost(CONFIG, 'app.example')).toBe(false);
    expect(isMappedHost(CONFIG, null)).toBe(false);
  });
});

describe('host config parsing', () => {
  const raw = (value: unknown) => JSON.stringify(value);

  it('parses the record and normalises the host', () => {
    expect(
      parseWhiteLabelHostConfig(
        raw([
          {
            id: 'c',
            hosts: [
              { host: 'Space.Partner.Example', space: 'space-one' },
              {
                host: 'b.partner.example',
                space: 'space-two',
                authConfig: {
                  privyClientId: 'client-1',
                  cookieDomain: 'partner.example',
                },
              },
            ],
          },
        ]),
      ),
    ).toEqual([
      {
        id: 'c',
        hosts: [
          { host: 'space.partner.example', spaceSlug: 'space-one' },
          {
            host: 'b.partner.example',
            spaceSlug: 'space-two',
            authConfig: {
              privyClientId: 'client-1',
              cookieDomain: 'partner.example',
            },
          },
        ],
      },
    ]);
  });

  it.each([undefined, null, '', '   ', '{nope', '{}', '"x"', '[1]'])(
    'unset, empty or unparsable (%j) means no host is mapped',
    (value) => {
      expect(parseWhiteLabelHostConfig(value as string)).toEqual([]);
    },
  );

  it('drops invalid hosts, slugs and client ids', () => {
    const parsed = parseWhiteLabelHostConfig(
      raw([
        { id: 'Bad Id', hosts: [{ host: 'a.example', space: 'ok' }] },
        {
          id: 'ok',
          hosts: [
            { host: '*.example', space: 'ok' },
            { host: 'a.example/path', space: 'ok' },
            { host: 'user@a.example', space: 'ok' },
            { host: 'a.example', space: 'Bad_Slug' },
            { host: 'a.example', space: '../x' },
            { host: 'ok.example', space: 'fine' },
          ],
        },
      ]),
    );
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.hosts).toEqual([
      { host: 'ok.example', spaceSlug: 'fine' },
    ]);
  });

  it('one owner per host: a host listed twice is dropped everywhere', () => {
    const parsed = parseWhiteLabelHostConfig(
      raw([
        {
          id: 'a',
          hosts: [
            { host: 'dup.example', space: 'one' },
            { host: 'only-a.example', space: 'one' },
          ],
        },
        { id: 'b', hosts: [{ host: 'DUP.example', space: 'two' }] },
      ]),
    );
    expect(parsed).toEqual([
      { id: 'a', hosts: [{ host: 'only-a.example', spaceSlug: 'one' }] },
    ]);
    const same = parseWhiteLabelHostConfig(
      raw([
        {
          id: 'a',
          hosts: [
            { host: 'dup.example', space: 'one' },
            { host: 'dup.example', space: 'one' },
          ],
        },
      ]),
    );
    expect(same).toEqual([]);
  });

  it('a malformed auth config drops the host (fail closed)', () => {
    const parsed = parseWhiteLabelHostConfig(
      raw([
        {
          id: 'c',
          hosts: [
            {
              host: 'a.partner.example',
              space: 'one',
              authConfig: { privyClientId: 'client-1' },
            },
            {
              host: 'b.partner.example',
              space: 'one',
              authConfig: {
                privyClientId: 'client-1',
                cookieDomain: 'other.example',
              },
            },
            {
              host: 'c.partner.example',
              space: 'one',
              authConfig: {
                privyClientId: 'bad id',
                cookieDomain: 'partner.example',
              },
            },
            { host: 'd.partner.example', space: 'one', authConfig: 'x' },
          ],
        },
      ]),
    );
    expect(parsed).toEqual([]);
  });

  it('the embed parser ignores the host config and leaves hosts empty', () => {
    expect(parseWhiteLabelConfig(undefined)).toEqual({
      clients: [],
      hostClients: [],
      mainHosts: [],
    });
  });

  it('normaliseHost', () => {
    expect(normaliseHost('Partner.Example')).toBe('partner.example');
    expect(normaliseHost('partner.example.')).toBe('partner.example');
    expect(normaliseHost('xn--r8jz45g.example')).toBe('xn--r8jz45g.example');
    expect(normaliseHost('localhost:3000')).toBe('localhost:3000');
    expect(normaliseHost('wl.localhost:3000')).toBe('wl.localhost:3000');
    expect(normaliseHost('127.0.0.1:3000')).toBe('127.0.0.1:3000');
    for (const bad of [
      '',
      'localhost:abc',
      'partner.example:8443',
      '10.0.0.1',
      '[::1]',
      '*.example',
      'a b.example',
      'a.example/x',
      'user@a.example',
      'single',
      '-a.example',
      'ü.example',
      42,
      null,
      undefined,
    ]) {
      expect(normaliseHost(bad)).toBeNull();
    }
  });

  it('parseAuthConfig: cookie domain is the host or a parent of it', () => {
    const host = 'space.partner.example';
    expect(
      parseAuthConfig({ privyClientId: 'client-1', cookieDomain: host }, host),
    ).toEqual({ privyClientId: 'client-1', cookieDomain: host });
    expect(
      parseAuthConfig(
        { privyClientId: 'client-1', cookieDomain: 'partner.example' },
        host,
      ),
    ).not.toBeNull();
    for (const cookieDomain of [
      'example',
      'evilpartner.example',
      'sub.space.partner.example',
      'partner.example:443',
    ]) {
      expect(
        parseAuthConfig({ privyClientId: 'client-1', cookieDomain }, host),
      ).toBeNull();
    }
  });
});

describe('internal request headers', () => {
  it('strips every incoming copy, including the new host-mode headers', () => {
    const incoming = new Headers({
      accept: 'text/html',
      'x-hypha-wl-space': 'forged',
      'X-Hypha-WL-Mode': 'host',
      'x-hypha-wl-client': 'forged',
      'x-hypha-wl-auth': '{"privyClientId":"forged"}',
      'x-hypha-wl-not-found': '1',
    });
    const stripped = stripWhiteLabelHeaders(incoming);
    for (const name of WL_REQUEST_HEADERS) {
      expect(stripped.has(name)).toBe(false);
    }
    expect(stripped.get('accept')).toBe('text/html');
    expect(incoming.has('x-hypha-wl-client')).toBe(true);
  });

  it('lists the client and auth headers among those stripped', () => {
    expect(WL_REQUEST_HEADERS).toContain('x-hypha-wl-client');
    expect(WL_REQUEST_HEADERS).toContain('x-hypha-wl-auth');
  });

  it('auth config round-trips through the header and rejects junk', () => {
    expect(readAuthConfigHeader(serializeAuthConfig(AUTH))).toEqual(AUTH);
    for (const junk of [
      null,
      '',
      '{',
      '[]',
      '"x"',
      '{"privyClientId":"bad id","cookieDomain":"a.example"}',
      '{"privyClientId":"client-1","cookieDomain":"*.example"}',
      '{"privyClientId":"client-1"}',
    ]) {
      expect(readAuthConfigHeader(junk)).toBeNull();
    }
  });
});

describe('/api on a mapped host', () => {
  const allowlist = [
    '/api/v1/spaces/:slug',
    '/api/v1/spaces/:slug/members',
    '/api/v1/tokens',
  ];
  const allowed = (method: string, path: string) =>
    isApiReadAllowed(
      method,
      path.split('/').filter(Boolean),
      'space-one',
      allowlist,
    );

  it('allows listed reads, GET and HEAD only', () => {
    expect(allowed('GET', '/api/v1/spaces/space-one')).toBe(true);
    expect(allowed('get', '/api/v1/spaces/space-one/members')).toBe(true);
    expect(allowed('HEAD', '/api/v1/tokens')).toBe(true);
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(allowed(method, '/api/v1/spaces/space-one')).toBe(false);
    }
  });

  it('refuses everything not listed, and extra or missing segments', () => {
    for (const path of [
      '/api',
      '/api/v1',
      '/api/v1/spaces',
      '/api/v1/spaces/space-one/members/extra',
      '/api/v1/spaces/space-one/update',
      '/api/v1/people/me',
      '/api/matrix/token',
      '/api/cron/signals-orchestrate',
      '/api/webhooks/space/created',
      '/api/uploadthing',
      '/API/v1/tokens',
      '/api/v1/Tokens',
    ]) {
      expect(allowed('GET', path)).toBe(false);
    }
  });

  it('a path parameter is one plain segment', () => {
    for (const slug of ['a b', '', 'x/y']) {
      expect(
        isApiReadAllowed('GET', ['api', 'v1', 'spaces', slug], slug, allowlist),
      ).toBe(false);
    }
  });

  it('Space-scoped paths: own slug only, other slug refused, unscoped unchanged', () => {
    expect(allowed('GET', '/api/v1/spaces/space-one')).toBe(true);
    expect(allowed('GET', '/api/v1/spaces/space-one/members')).toBe(true);
    expect(allowed('GET', '/api/v1/spaces/space-two')).toBe(false);
    expect(allowed('GET', '/api/v1/spaces/space-two/members')).toBe(false);
    expect(allowed('GET', '/api/v1/spaces/Space-One')).toBe(false);
    // Not Space-scoped: unchanged by the slug check.
    expect(allowed('GET', '/api/v1/tokens')).toBe(true);
    // Fails closed without an own slug.
    expect(
      isApiReadAllowed(
        'GET',
        ['api', 'v1', 'spaces', 'space-one'],
        undefined,
        allowlist,
      ),
    ).toBe(false);
  });

  it('the real allowlist serves the documents, overview and treasury reads for the own Space only', () => {
    const real = (method: string, path: string, slug = 'space-one') =>
      isApiReadAllowed(
        method,
        path.split('/').filter(Boolean),
        slug,
        WL_API_READ_ALLOWLIST,
      );
    for (const path of [
      '/api/v1/spaces/space-one/documents',
      '/api/v1/spaces/space-one/documents/all',
      '/api/v1/spaces/space-one/overview-activity',
      '/api/v1/spaces/space-one/token-holdings',
    ]) {
      expect(real('GET', path)).toBe(true);
      expect(real('HEAD', path)).toBe(true);
      for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        expect(real(method, path)).toBe(false);
      }
      // Another Space's slug is refused, and so is the Space without a slug.
      expect(real('GET', path.replace('space-one', 'space-two'))).toBe(false);
      expect(
        isApiReadAllowed(
          'GET',
          path.split('/').filter(Boolean),
          undefined,
          WL_API_READ_ALLOWLIST,
        ),
      ).toBe(false);
    }
    // Extra segments are not matched.
    expect(real('GET', '/api/v1/spaces/space-one/documents/all/x')).toBe(false);
    expect(real('GET', '/api/v1/spaces/space-one/documents/some-doc')).toBe(
      false,
    );
  });

  it('the real allowlist serves events, spaces and voters; the own-Space rule is in the handler', () => {
    const real = (method: string, path: string) =>
      isApiReadAllowed(method, path.split('/').filter(Boolean), 'space-one');
    expect(real('GET', '/api/v1/events')).toBe(true);
    expect(real('HEAD', '/api/v1/spaces')).toBe(true);
    // `:documentSlug` is a document slug, not the Space slug.
    expect(real('GET', '/api/v1/documents/my-proposal-1a2b3c4d/voters')).toBe(
      true,
    );
    expect(
      real('GET', "/api/v1/documents/what's-this_(1)-1a2b3c4d/voters"),
    ).toBe(true);
    // Methods, extra segments and odd segments stay refused.
    expect(real('POST', '/api/v1/events')).toBe(false);
    expect(real('POST', '/api/v1/spaces')).toBe(false);
    expect(real('GET', '/api/v1/events/1')).toBe(false);
    expect(real('GET', '/api/v1/documents/x/voters/extra')).toBe(false);
    expect(real('GET', '/api/v1/documents/voters')).toBe(false);
    expect(real('GET', '/api/v1/documents/a%b/voters')).toBe(false);
    expect(real('GET', '/api/v1/documents/a b/voters')).toBe(false);
    // The path of another document is not the Space check: handler's job.
    expect(real('GET', '/api/v1/documents/other-spaces-doc/voters')).toBe(true);
  });

  it('the resolver passes the host Space on with an allowed /api read', () => {
    expect(run('/api/v1/events', { method: 'GET' })).toEqual({
      kind: 'api-allow',
      spaceSlug: 'space-one',
    });
    expect(run('/api/v1/events', { method: 'POST' })).toEqual({
      kind: 'not-found',
      reason: 'api-not-allowed',
    });
  });

  it('with the real allowlist, an empty list refuses everything', () => {
    expect(isApiReadAllowed('GET', ['api', 'v1', 'spaces', 'x'], 'x', [])).toBe(
      false,
    );
  });

  it('the resolver applies the host Space slug to /api', () => {
    expect(run('/api/v1/spaces/space-one', { method: 'GET' })).toEqual({
      kind: 'api-allow',
      spaceSlug: 'space-one',
    });
    expect(run('/api/v1/spaces/space-two', { method: 'GET' })).toEqual({
      kind: 'not-found',
      reason: 'api-not-allowed',
    });
    expect(run('/api/v1/currency-rates', { method: 'GET' })).toEqual({
      kind: 'api-allow',
      spaceSlug: 'space-one',
    });
  });

  it('the resolver answers /api on a mapped host through the allowlist', () => {
    expect(run('/api/v1/people/me/intelligence', { method: 'POST' })).toEqual({
      kind: 'not-found',
      reason: 'api-not-allowed',
    });
    expect(run('/api/%2e%2e/x', { method: 'GET' })).toEqual({
      kind: 'not-found',
      reason: 'malformed-path',
    });
    expect(run('/api', { method: 'GET' })).toEqual({
      kind: 'not-found',
      reason: 'api-not-allowed',
    });
  });
});

describe('link guard: host mode', () => {
  const ctx: WhiteLabelLinkContext = {
    mode: 'host',
    spaceSlug: 'space-one',
    lang: 'en',
    fullAppOrigin: 'https://app.example',
  };
  const here = 'https://space.partner.example';

  it('builds section hrefs at the host root', () => {
    expect(sectionHref(ctx, 'members')).toBe('/en/members');
    expect(sectionHref(ctx, 'overview', '?board=space')).toBe(
      '/en/overview?board=space',
    );
  });

  it('keeps links to this Space on the host', () => {
    expect(classifyLink('/en/dho/space-one/agreements', ctx, here)).toEqual({
      kind: 'internal',
      href: '/en/agreements',
    });
    expect(classifyLink('/pt/dho/space-one', ctx, here)).toEqual({
      kind: 'internal',
      href: '/en/overview',
    });
    expect(classifyLink('/en/members', ctx, here)).toEqual({
      kind: 'internal',
      href: '/en/members',
    });
    expect(classifyLink('/members?x=1', ctx, here)).toEqual({
      kind: 'internal',
      href: '/en/members?x=1',
    });
    expect(classifyLink('/', ctx, here)).toEqual({
      kind: 'internal',
      href: '/en/overview',
    });
  });

  it('links that leave the Space open the full app, not the host', () => {
    for (const href of [
      '/en/dho/space-one/members/person/jane',
      '/en/dho/space-one/agreements/proposal/p1',
      '/en/dho/space-one/agreements/create/pay-for-expenses',
      '/en/dho/other-space/overview',
      '/en/profile/jane',
    ]) {
      const decision = classifyLink(href, ctx, here);
      expect(decision?.kind).toBe('external');
      expect(decision && 'href' in decision && decision.href).toBe(
        `https://app.example${href}`,
      );
    }
    expect(classifyLink('/en/network?q=1#top', ctx, here)).toEqual({
      kind: 'external',
      href: 'https://app.example/en/network?q=1#top',
    });
  });

  it('pages of the Space that are not served leave too (no dead page)', () => {
    expect(classifyLink('/en/dho/space-one/settings', ctx, here)).toEqual({
      kind: 'external',
      href: 'https://app.example/en/dho/space-one/settings',
    });
    expect(classifyLink('/en/members/deeper', ctx, here)).toMatchObject({
      kind: 'external',
    });
  });

  it('other origins are external as written; mailto and hash are left alone', () => {
    expect(classifyLink('https://other.example/x', ctx, here)).toEqual({
      kind: 'external',
      href: 'https://other.example/x',
    });
    expect(classifyLink('mailto:a@b.example', ctx, here)).toBeNull();
    expect(classifyLink('#top', ctx, here)).toBeNull();
    expect(classifyLink('', ctx, here)).toBeNull();
  });

  it('the section of a browser path, with and without a locale', () => {
    expect(sectionFromPathname(ctx, '/')).toBe('overview');
    expect(sectionFromPathname(ctx, '/members')).toBe('members');
    expect(sectionFromPathname(ctx, '/en/members')).toBe('members');
    expect(sectionFromPathname(ctx, '/en')).toBe('overview');
    const embed: WhiteLabelLinkContext = {
      mode: 'embed',
      spaceSlug: 'space-one',
      lang: 'en',
    };
    expect(sectionFromPathname(embed, '/embed/space-one')).toBe('overview');
    expect(sectionFromPathname(embed, '/embed/space-one/en/members')).toBe(
      'members',
    );
    expect(sectionFromPathname(embed, '/embed/space-one/treasury')).toBe(
      'treasury',
    );
  });
});

describe('link guard: embed keeps working', () => {
  const ctx: WhiteLabelLinkContext = {
    mode: 'embed',
    spaceSlug: 'space-one',
    lang: 'en',
  };
  const app = 'https://app.example';

  it('only served sections stay in the embed; others leave', () => {
    expect(classifyLink('/en/dho/space-one/members', ctx, app)).toEqual({
      kind: 'internal',
      href: '/embed/space-one/en/members',
    });
    expect(classifyLink('/en/dho/space-one/settings', ctx, app)).toEqual({
      kind: 'external',
      href: '/en/dho/space-one/settings',
    });
  });

  it('a host-style path is not an embed link', () => {
    expect(classifyLink('/en/members', ctx, app)?.kind).toBe('external');
  });
});

describe('main hosts derived from env', () => {
  const ENV_KEYS = [
    'WHITE_LABEL_HOST_CONFIG',
    'NEXT_PUBLIC_APP_URL',
    'VERCEL_URL',
    'VERCEL_BRANCH_URL',
    'VERCEL_PROJECT_PRODUCTION_URL',
  ] as const;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.WHITE_LABEL_HOST_CONFIG = JSON.stringify([
      { id: 'c', hosts: [{ host: 'space.partner.example', space: 'one' }] },
    ]);
  });
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('falls back to the default app host when the app URL is unset', () => {
    expect(getWhiteLabelConfig().mainHosts).toContain('app.hypha.earth');
  });

  it('uses the app URL host when it is set', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://main.example';
    const { mainHosts } = getWhiteLabelConfig();
    expect(mainHosts).toContain('main.example');
    expect(mainHosts).not.toContain('app.hypha.earth');
  });
});

describe('host links in another locale', () => {
  const ctx = {
    mode: 'host' as const,
    spaceSlug: 'space-one',
    lang: 'en',
    fullAppOrigin: 'https://app.example',
  };
  const origin = 'https://space.partner.example';
  const locales = ['en', 'pt', 'de'];

  it('keeps a section link in any configured locale, with that locale', () => {
    expect(classifyLink('/pt/members', ctx, origin, locales)).toEqual({
      kind: 'internal',
      href: '/pt/members',
    });
    expect(classifyLink('/de', ctx, origin, locales)).toEqual({
      kind: 'internal',
      href: '/de/overview',
    });
    expect(classifyLink('/en/members', ctx, origin, locales)).toEqual({
      kind: 'internal',
      href: '/en/members',
    });
  });

  it('still sends unserved paths and unknown prefixes to the full app', () => {
    expect(classifyLink('/pt/nope', ctx, origin, locales)).toMatchObject({
      kind: 'external',
    });
    expect(classifyLink('/xx/members', ctx, origin, locales)).toMatchObject({
      kind: 'external',
    });
  });
});

describe('host client ids', () => {
  it('drops every client whose id is given twice', () => {
    const raw = JSON.stringify([
      { id: 'dup', hosts: [{ host: 'a.example', space: 'one' }] },
      { id: 'dup', hosts: [{ host: 'b.example', space: 'two' }] },
      { id: 'ok', hosts: [{ host: 'c.example', space: 'three' }] },
    ]);
    expect(parseWhiteLabelHostConfig(raw).map((c) => c.id)).toEqual(['ok']);
  });
});

describe('apiRequestHeaders (the headers an /api route sees)', () => {
  const forged = () =>
    new Headers({
      host: 'partner.example',
      authorization: 'Bearer x',
      [WL_SPACE_HEADER]: 'someone-elses-space',
      [WL_MODE_HEADER]: 'host',
      [WL_CLIENT_HEADER]: 'forged-client',
    });

  it('main host: a forged inbound white-label header is stripped and none is set', () => {
    const headers = apiRequestHeaders(forged());
    for (const name of WL_REQUEST_HEADERS)
      expect(headers.has(name)).toBe(false);
    expect(headers.get('authorization')).toBe('Bearer x');
  });

  it('mapped host: forged copies are replaced by the validated own slug only', () => {
    const headers = apiRequestHeaders(forged(), 'space-one');
    expect(headers.get(WL_SPACE_HEADER)).toBe('space-one');
    expect(headers.has(WL_MODE_HEADER)).toBe(false);
    expect(headers.has(WL_CLIENT_HEADER)).toBe(false);
    expect(headers.get('authorization')).toBe('Bearer x');
  });

  it('does not change the headers it is given', () => {
    const input = forged();
    apiRequestHeaders(input, 'space-one');
    expect(input.get(WL_SPACE_HEADER)).toBe('someone-elses-space');
  });
});
