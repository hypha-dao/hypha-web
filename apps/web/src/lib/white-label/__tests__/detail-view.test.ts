import { describe, expect, it } from 'vitest';

import {
  WL_SERVED_DETAIL_PATTERNS,
  WL_DETAIL_VIEW_HEADER,
  classifyLink,
  parseWhiteLabelConfig,
  parseWhiteLabelHostConfig,
  resolve,
  stripWhiteLabelHeaders,
  type ResolveOptions,
  type WhiteLabelConfig,
  type WhiteLabelLinkContext,
} from '..';

const OPTIONS: ResolveOptions = {
  locales: ['en', 'pt', 'es', 'fr', 'de', 'mk', 'nl', 'no'],
  defaultLocale: 'en',
};
const ORIGINS = ['https://partner.example'];
type View = 'embedded' | 'full-app';

describe('detailView in the config', () => {
  const embed = (extra: string) =>
    parseWhiteLabelConfig(
      `[{"id":"c1"${extra},"spaces":[{"slug":"s1","framingOrigins":["https://partner.example"]}]}]`,
    ).clients[0];
  const host = (extra: string) =>
    parseWhiteLabelHostConfig(
      `[{"id":"c1"${extra},"hosts":[{"host":"space.partner.example","space":"s1"}]}]`,
    )[0];

  it('absent stays absent (the default applies at resolve time)', () => {
    expect(embed('')).not.toHaveProperty('detailView');
    expect(host('')).not.toHaveProperty('detailView');
  });

  it('accepts the two values, in both configs', () => {
    expect(embed(',"detailView":"embedded"')?.detailView).toBe('embedded');
    expect(embed(',"detailView":"full-app"')?.detailView).toBe('full-app');
    expect(host(',"detailView":"embedded"')?.detailView).toBe('embedded');
    expect(host(',"detailView":"full-app"')?.detailView).toBe('full-app');
  });

  it('fails closed: any other value serves no detail page', () => {
    for (const bad of [
      '"Embedded"',
      '"overlay"',
      '""',
      'true',
      '1',
      'null',
      '[]',
    ]) {
      expect(embed(`,"detailView":${bad}`)?.detailView).toBe('full-app');
      expect(host(`,"detailView":${bad}`)?.detailView).toBe('full-app');
    }
  });
});

describe('detailView on the resolver result', () => {
  const embedConfig = (views: (View | undefined)[]): WhiteLabelConfig => ({
    hostClients: [],
    mainHosts: [],
    clients: views.map((view, i) => ({
      id: `c${i}`,
      ...(view ? { detailView: view } : {}),
      spaces: [{ slug: 'space-one', framingOrigins: ORIGINS }],
    })),
  });
  const embedView = (views: (View | undefined)[]) => {
    const d = resolve(
      'h',
      '/embed/space-one/en/agreements',
      embedConfig(views),
      OPTIONS,
    );
    return d.kind === 'rewrite' ? d.detailView : null;
  };

  it('embed: default embedded', () => {
    expect(embedView([undefined])).toBe('embedded');
    expect(embedView(['embedded'])).toBe('embedded');
    expect(embedView(['full-app'])).toBe('full-app');
  });

  it('embed, a Space approved by two clients: embedded wins if any says so', () => {
    expect(embedView(['full-app', 'embedded'])).toBe('embedded');
    expect(embedView(['full-app', undefined])).toBe('embedded');
    expect(embedView(['full-app', 'full-app'])).toBe('full-app');
  });

  it('host: the owning client value, default embedded', () => {
    const config = (view?: View): WhiteLabelConfig => ({
      clients: [],
      mainHosts: ['app.example'],
      hostClients: [
        {
          id: 'h1',
          ...(view ? { detailView: view } : {}),
          hosts: [{ host: 'space.partner.example', spaceSlug: 'space-one' }],
        },
      ],
    });
    const view = (v?: View) => {
      const d = resolve(
        'space.partner.example',
        '/en/agreements',
        config(v),
        OPTIONS,
      );
      return d.kind === 'rewrite' ? d.detailView : null;
    };
    expect(view()).toBe('embedded');
    expect(view('full-app')).toBe('full-app');
    expect(view('embedded')).toBe('embedded');
  });

  it('a visitor can not forge the header: it is stripped like the others', () => {
    const headers = new Headers({ [WL_DETAIL_VIEW_HEADER]: 'embedded' });
    expect(stripWhiteLabelHeaders(headers).has(WL_DETAIL_VIEW_HEADER)).toBe(
      false,
    );
  });
});

describe('/api on a mapped host: document and tokens through the resolver', () => {
  const config: WhiteLabelConfig = {
    clients: [],
    mainHosts: ['app.example'],
    hostClients: [
      {
        id: 'h1',
        hosts: [{ host: 'space.partner.example', spaceSlug: 'space-one' }],
      },
    ],
  };
  const run = (path: string, method = 'GET') =>
    resolve('space.partner.example', path, config, { ...OPTIONS, method });

  it('serves documents/<slug>/ (trailing slash) and slugs with special characters', () => {
    for (const path of [
      '/api/v1/documents/my-proposal-1a2b3c4d/',
      '/api/v1/documents/my-proposal-1a2b3c4d',
      "/api/v1/documents/what's-this_(1)-1a2b3c4d/",
    ]) {
      expect(run(path).kind, path).toBe('api-allow');
    }
    expect(run('/api/v1/tokens').kind).toBe('api-allow');
  });

  it('refuses writes to both and nested paths', () => {
    expect(run('/api/v1/documents/x', 'POST').kind).toBe('not-found');
    expect(run('/api/v1/tokens', 'POST').kind).toBe('not-found');
    expect(run('/api/v1/documents/x/extra').kind).toBe('not-found');
  });
});

describe('link guard: served detail pages', () => {
  const here = 'https://space.partner.example';
  const app = 'https://app.example';
  const host = (detailView?: View): WhiteLabelLinkContext => ({
    mode: 'host',
    spaceSlug: 'space-one',
    lang: 'en',
    fullAppOrigin: app,
    ...(detailView ? { detailView } : {}),
  });
  const embed = (detailView?: View): WhiteLabelLinkContext => ({
    mode: 'embed',
    spaceSlug: 'space-one',
    lang: 'en',
    ...(detailView ? { detailView } : {}),
  });
  const locales = OPTIONS.locales;

  it('the served patterns: proposal, voters, signal, pipeline track', () => {
    expect(WL_SERVED_DETAIL_PATTERNS).toEqual([
      ['agreements', 'proposal', ':'],
      ['agreements', 'proposal', ':', 'voters'],
      ['coherence', 'signal', ':'],
      ['pipeline', 'track', ':'],
    ]);
  });

  it('voters links stay on the host, in every shape', () => {
    for (const [href, expected] of [
      [
        '/en/agreements/proposal/p1/voters',
        '/en/agreements/proposal/p1/voters',
      ],
      [
        '/en/dho/space-one/agreements/proposal/p1/voters',
        '/en/agreements/proposal/p1/voters',
      ],
      [
        '/pt/agreements/proposal/p1/voters?a=1',
        '/pt/agreements/proposal/p1/voters?a=1',
      ],
    ] as const) {
      expect(classifyLink(href, host(), here, locales), href).toEqual({
        kind: 'internal',
        href: expected,
      });
    }
  });

  it('voters links stay in the frame', () => {
    expect(
      classifyLink(
        '/embed/space-one/en/agreements/proposal/p1/voters',
        embed(),
        app,
        locales,
      ),
    ).toEqual({
      kind: 'internal',
      href: '/embed/space-one/en/agreements/proposal/p1/voters',
    });
  });

  it('detailView full-app: voters links leave in the main-app shape', () => {
    expect(
      classifyLink(
        '/en/agreements/proposal/p1/voters',
        host('full-app'),
        here,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: `${app}/en/dho/space-one/agreements/proposal/p1/voters`,
    });
  });

  it('signal detail links stay on the host, in every shape', () => {
    for (const [href, expected] of [
      ['/en/coherence/signal/s1', '/en/coherence/signal/s1'],
      ['/en/dho/space-one/coherence/signal/s1', '/en/coherence/signal/s1'],
      ['/pt/coherence/signal/a%20b?x=1', '/pt/coherence/signal/a%20b?x=1'],
    ] as const) {
      expect(classifyLink(href, host(), here, locales), href).toEqual({
        kind: 'internal',
        href: expected,
      });
    }
  });

  it('signal detail links stay in the frame (main-app and frame shapes)', () => {
    for (const href of [
      '/embed/space-one/en/coherence/signal/s1',
      '/en/dho/space-one/coherence/signal/s1',
    ]) {
      expect(classifyLink(href, embed(), app, locales), href).toEqual({
        kind: 'internal',
        href: '/embed/space-one/en/coherence/signal/s1',
      });
    }
  });

  it('detailView full-app: a signal link leaves in the main-app shape', () => {
    expect(
      classifyLink('/en/coherence/signal/s1', host('full-app'), here, locales),
    ).toEqual({
      kind: 'external',
      href: `${app}/en/dho/space-one/coherence/signal/s1`,
    });
  });

  it('coherence pages that are not served still leave (another Space); new signal is a create flow', () => {
    expect(
      classifyLink(
        '/en/dho/space-one/coherence/new-signal',
        host(),
        here,
        locales,
      ),
    ).toEqual({ kind: 'blocked' });
    expect(
      classifyLink(
        '/en/dho/other-space/coherence/signal/s1',
        host(),
        here,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: `${app}/en/dho/other-space/coherence/signal/s1`,
    });
  });

  it('a main-app detail link keeps its own locale (host and frame)', () => {
    for (const rest of [
      'coherence/signal/s1',
      'pipeline/track/sales',
      'agreements/proposal/p1',
    ]) {
      expect(
        classifyLink(`/pt/dho/space-one/${rest}`, host(), here, locales),
        rest,
      ).toEqual({ kind: 'internal', href: `/pt/${rest}` });
      expect(
        classifyLink(`/pt/dho/space-one/${rest}`, embed(), app, locales),
        rest,
      ).toEqual({
        kind: 'internal',
        href: `/embed/space-one/pt/${rest}`,
      });
    }
  });

  it('pipeline track links stay on the host, in every shape', () => {
    for (const [href, expected] of [
      ['/en/pipeline/track/sales', '/en/pipeline/track/sales'],
      ['/en/dho/space-one/pipeline/track/sales', '/en/pipeline/track/sales'],
      ['/pt/pipeline/track/a%20b?x=1', '/pt/pipeline/track/a%20b?x=1'],
    ] as const) {
      expect(classifyLink(href, host(), here, locales), href).toEqual({
        kind: 'internal',
        href: expected,
      });
    }
  });

  it('pipeline track links stay in the frame (main-app and frame shapes)', () => {
    for (const href of [
      '/embed/space-one/en/pipeline/track/sales',
      '/en/dho/space-one/pipeline/track/sales',
    ]) {
      expect(classifyLink(href, embed(), app, locales), href).toEqual({
        kind: 'internal',
        href: '/embed/space-one/en/pipeline/track/sales',
      });
    }
  });

  it('detailView full-app: a track link leaves in the main-app shape', () => {
    expect(
      classifyLink('/en/pipeline/track/sales', host('full-app'), here, locales),
    ).toEqual({
      kind: 'external',
      href: `${app}/en/dho/space-one/pipeline/track/sales`,
    });
  });

  it('pipeline pages that are not served still leave (deal, new deal)', () => {
    for (const rest of ['pipeline/deal/5', 'pipeline/new-deal']) {
      expect(
        classifyLink('/en/dho/space-one/' + rest, host(), here, locales),
        rest,
      ).toEqual({
        kind: 'external',
        href: `${app}/en/dho/space-one/${rest}`,
      });
    }
  });

  it('a track link of another Space is not mapped onto this one', () => {
    expect(
      classifyLink(
        '/en/dho/other-space/pipeline/track/sales',
        host(),
        here,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: `${app}/en/dho/other-space/pipeline/track/sales`,
    });
  });

  it('host: a proposal link (main-app or host shaped) stays on the host', () => {
    for (const href of [
      '/en/dho/space-one/agreements/proposal/p1',
      '/en/agreements/proposal/p1',
      '/agreements/proposal/p1',
    ]) {
      expect(classifyLink(href, host(), here, locales), href).toEqual({
        kind: 'internal',
        href: '/en/agreements/proposal/p1',
      });
    }
    expect(
      classifyLink('/en/agreements/proposal/p1?x=1#h', host(), here, locales),
    ).toEqual({ kind: 'internal', href: '/en/agreements/proposal/p1?x=1' });
  });

  it('embed: a proposal link stays in the frame', () => {
    const expected = {
      kind: 'internal',
      href: '/embed/space-one/en/agreements/proposal/p1',
    };
    expect(
      classifyLink(
        '/en/dho/space-one/agreements/proposal/p1',
        embed(),
        app,
        locales,
      ),
    ).toEqual(expected);
    expect(
      classifyLink(
        '/embed/space-one/en/agreements/proposal/p1',
        embed(),
        app,
        locales,
      ),
    ).toEqual(expected);
  });

  it('detailView full-app: the proposal link leaves, in the main-app shape', () => {
    const main = `${app}/en/dho/space-one/agreements/proposal/p1`;
    expect(
      classifyLink(
        '/en/dho/space-one/agreements/proposal/p1',
        host('full-app'),
        here,
        locales,
      ),
    ).toEqual({ kind: 'external', href: main });
    // A host-shaped link too: never the bare host path on the full app.
    expect(
      classifyLink(
        '/en/agreements/proposal/p1',
        host('full-app'),
        here,
        locales,
      ),
    ).toEqual({ kind: 'external', href: main });
    expect(
      classifyLink(
        '/embed/space-one/en/agreements/proposal/p1',
        embed('full-app'),
        app,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: '/en/dho/space-one/agreements/proposal/p1',
    });
  });

  it('a host-shaped unserved path (the old voters link bug) leaves with /dho/<slug>', () => {
    expect(
      classifyLink('/en/agreements/proposal/p1/other', host(), here, locales),
    ).toEqual({
      kind: 'external',
      href: `${app}/en/dho/space-one/agreements/proposal/p1/other`,
    });
    // Without a locale: the page's own is used.
    expect(
      classifyLink('/members/person/jane/extra', host(), here, locales),
    ).toEqual({
      kind: 'external',
      href: `${app}/en/dho/space-one/members/person/jane/extra`,
    });
    // Another locale in the link is kept; query and hash survive.
    expect(
      classifyLink(
        '/pt/agreements/proposal/p1/other?a=1#b',
        host(),
        here,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: `${app}/pt/dho/space-one/agreements/proposal/p1/other?a=1#b`,
    });
    // Embed: the frame is on the full app's origin, so a relative path is right.
    expect(
      classifyLink(
        '/embed/space-one/en/agreements/proposal/p1/other',
        embed(),
        app,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: '/en/dho/space-one/agreements/proposal/p1/other',
    });
  });

  it('main-app paths that are not host-shaped are untouched', () => {
    expect(classifyLink('/en/profile/jane', host(), here, locales)).toEqual({
      kind: 'external',
      href: `${app}/en/profile/jane`,
    });
    expect(
      classifyLink('/en/dho/space-one/settings', host(), here, locales),
    ).toEqual({ kind: 'external', href: `${app}/en/dho/space-one/settings` });
    expect(
      classifyLink(
        '/en/dho/other-space/agreements/proposal/p1',
        host(),
        here,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: `${app}/en/dho/other-space/agreements/proposal/p1`,
    });
  });

  it('extra segments and create flows are not served details', () => {
    for (const href of [
      '/en/agreements/proposal',
      '/en/agreements/proposal/p1/p2',
    ]) {
      expect(classifyLink(href, host(), here, locales)?.kind, href).toBe(
        'external',
      );
    }
    // A create flow is not a served detail: blocked by default.
    expect(
      classifyLink(
        '/en/agreements/create/pay-for-expenses',
        host(),
        here,
        locales,
      ),
    ).toEqual({ kind: 'blocked' });
  });
});
