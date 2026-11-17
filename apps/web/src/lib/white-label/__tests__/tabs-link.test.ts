import { describe, expect, it } from 'vitest';

import {
  classifyLink,
  sectionFromPathname,
  type Tab,
  type WhiteLabelLinkContext,
} from '..';

const APP = 'https://space.partner.example';
const LOCALES = ['en', 'pt'];

const host = (
  tabs?: Tab[],
  extra: Partial<WhiteLabelLinkContext> = {},
): WhiteLabelLinkContext =>
  ({
    mode: 'host',
    spaceSlug: 's1',
    lang: 'en',
    fullAppOrigin: 'https://app.example',
    ...(tabs ? { tabs } : {}),
    ...extra,
  } as WhiteLabelLinkContext);
const frame = (
  tabs?: Tab[],
  extra: Partial<WhiteLabelLinkContext> = {},
): WhiteLabelLinkContext =>
  ({
    mode: 'embed',
    spaceSlug: 's1',
    lang: 'en',
    ...(tabs ? { tabs } : {}),
    ...extra,
  } as WhiteLabelLinkContext);

const SHOWN: Tab[] = ['members', 'treasury']; // overview is hidden
const link = (href: string, ctx: WhiteLabelLinkContext) =>
  classifyLink(href, ctx, APP, LOCALES);

describe('link guard: a hidden tab is inert', () => {
  const hiddenHrefs = [
    '/en/agreements',
    '/en/agreements/proposal/p1',
    '/en/agreements/proposal/p1/voters',
    '/en/agreements/select-create-action',
    '/en/agreements/create/propose-contribution',
    '/en/coherence',
    '/en/coherence/signal/s1',
    '/en/coherence/new-signal',
    '/en/pipeline/track/t1',
    '/en/calendar',
    '/pt/rewards',
    '/en/energy',
  ];

  it('host: blocked', () => {
    for (const href of hiddenHrefs) {
      expect(link(href, host(SHOWN)), href).toEqual({ kind: 'blocked' });
    }
  });

  it('host, main-app shaped links: blocked', () => {
    for (const href of [
      '/en/dho/s1/agreements',
      '/en/dho/s1/agreements/proposal/p1',
      '/en/dho/s1/coherence/new-signal',
      '/pt/dho/s1/calendar',
    ]) {
      expect(link(href, host(SHOWN)), href).toEqual({ kind: 'blocked' });
    }
  });

  it('frame: blocked, with and without a selected client', () => {
    for (const ctx of [frame(SHOWN), frame(SHOWN, { clientId: 'c1' })]) {
      for (const href of [
        '/embed/s1/en/agreements',
        '/embed/s1/en/agreements/proposal/p1',
        '/embed/s1/en/coherence/signal/s1',
        '/embed/s1/pt/calendar',
        '/en/dho/s1/agreements',
      ]) {
        expect(link(href, ctx), href).toEqual({ kind: 'blocked' });
      }
    }
  });

  it('also under unsupportedActions full-app: no exit to the full app', () => {
    const cases: [WhiteLabelLinkContext, string[]][] = [
      [
        host(SHOWN, { unsupportedActions: 'full-app' }),
        ['/en/agreements', '/en/agreements/create', '/en/dho/s1/agreements'],
      ],
      [
        frame(SHOWN, { unsupportedActions: 'full-app' }),
        [
          '/embed/s1/en/agreements',
          '/embed/s1/en/agreements/create',
          '/en/dho/s1/agreements',
        ],
      ],
    ];
    for (const [ctx, hrefs] of cases) {
      for (const href of hrefs) {
        expect(link(href, ctx), href).toEqual({ kind: 'blocked' });
      }
    }
  });

  it('a tab the client shows stays as before, detail pages included', () => {
    const ctx = host(['agreements', 'coherence']);
    expect(link('/en/agreements', ctx)).toEqual({
      kind: 'internal',
      href: '/en/agreements',
    });
    expect(link('/en/agreements/proposal/p1', ctx)).toEqual({
      kind: 'internal',
      href: '/en/agreements/proposal/p1',
    });
    expect(link('/en/dho/s1/coherence/signal/x', ctx)).toEqual({
      kind: 'internal',
      href: '/en/coherence/signal/x',
    });
  });

  it('banking follows treasury', () => {
    expect(link('/en/banking', host(['treasury']))).toEqual({
      kind: 'internal',
      href: '/en/banking',
    });
    expect(link('/en/banking', host(['members']))).toEqual({ kind: 'blocked' });
  });

  it('no tabs set: nothing is hidden (as before)', () => {
    expect(link('/en/agreements', host())?.kind).toBe('internal');
    expect(link('/embed/s1/en/agreements', frame())?.kind).toBe('internal');
  });
});

describe('link guard: encoded section names', () => {
  it('an encoded hidden section is inert in every link shape', () => {
    expect(link('/en/%61greements', host(SHOWN))).toEqual({ kind: 'blocked' });
    expect(link('/embed/s1/en/%61greements', frame(SHOWN))).toEqual({
      kind: 'blocked',
    });
    expect(link('/en/dho/s1/%61greements', frame(SHOWN))).toEqual({
      kind: 'blocked',
    });
    expect(link('/en/dho/s1/%61greements', host(SHOWN))).toEqual({
      kind: 'blocked',
    });
  });

  it('an encoded overview goes to the landing, like the plain one', () => {
    expect(link('/en/%6Fverview', host(SHOWN))).toEqual(
      link('/en/overview', host(SHOWN)),
    );
  });

  it('a malformed escape does not throw and is not a section', () => {
    expect(() => link('/en/%E0%A4%A', host(SHOWN))).not.toThrow();
    expect(() => link('/embed/s1/en/%zz', frame(SHOWN))).not.toThrow();
  });
});

describe('link guard: overview and landing links', () => {
  it('host: the root, and overview links, go to the first listed tab', () => {
    const ctx = host(SHOWN);
    for (const href of [
      '/',
      '/en',
      '/en/overview',
      '/en/dho/s1',
      '/en/dho/s1/overview',
    ]) {
      expect(link(href, ctx), href).toEqual({
        kind: 'internal',
        href: '/en/members',
      });
    }
  });

  it('host: the link keeps its own locale', () => {
    expect(link('/pt/overview', host(SHOWN))).toEqual({
      kind: 'internal',
      href: '/pt/members',
    });
  });

  it('frame: overview links go to the first listed tab, carrying the client', () => {
    const ctx = frame(SHOWN, { clientId: 'c1' });
    expect(link('/embed/s1/pt/overview', ctx)).toEqual({
      kind: 'internal',
      href: '/embed/s1/pt/members?client=c1',
    });
    expect(link('/en/dho/s1/overview', ctx)).toEqual({
      kind: 'internal',
      href: '/embed/s1/en/members?client=c1',
    });
  });

  it('overview visible (even when not first): overview links stay on overview', () => {
    const ctx = host(['members', 'overview']);
    expect(link('/en/overview', ctx)).toEqual({
      kind: 'internal',
      href: '/en/overview',
    });
    expect(link('/en/dho/s1', ctx)).toEqual({
      kind: 'internal',
      href: '/en/overview',
    });
  });

  it('all tabs: unchanged', () => {
    expect(link('/en/dho/s1', host())).toEqual({
      kind: 'internal',
      href: '/en/overview',
    });
    expect(link('/', host())).toEqual({
      kind: 'internal',
      href: '/en/overview',
    });
  });
});

describe('other links are untouched by tabs', () => {
  it('another site, mailto, hash, and a Space page that is not a section', () => {
    const ctx = host(SHOWN);
    expect(link('https://other.example/x', ctx)).toEqual({
      kind: 'external',
      href: 'https://other.example/x',
    });
    expect(link('mailto:a@b.example', ctx)).toBeNull();
    expect(link('#top', ctx)).toBeNull();
    expect(link('/en/members', ctx)).toEqual({
      kind: 'internal',
      href: '/en/members',
    });
  });
});

describe('sectionFromPathname: the default is the first listed tab', () => {
  it('host and frame', () => {
    expect(sectionFromPathname(host(SHOWN), '/')).toBe('members');
    expect(sectionFromPathname(host(SHOWN), '/en')).toBe('members');
    expect(sectionFromPathname(host(SHOWN), '/en/treasury')).toBe('treasury');
    expect(sectionFromPathname(frame(SHOWN), '/embed/s1/en')).toBe('members');
    expect(sectionFromPathname(host(), '/')).toBe('overview');
  });
});
