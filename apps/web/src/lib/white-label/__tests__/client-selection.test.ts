import { describe, expect, it } from 'vitest';

import {
  WL_CLIENT_HEADER,
  WL_CLIENT_PARAM,
  classifyLink,
  resolve,
  sectionHref,
  withClient,
  type ResolveOptions,
  type WhiteLabelConfig,
  type WhiteLabelLinkContext,
} from '..';

const OPTIONS: ResolveOptions = { locales: ['en', 'pt'], defaultLocale: 'en' };
const APP = 'https://app.example';

const config = (): WhiteLabelConfig => ({
  hostClients: [],
  mainHosts: ['app.example'],
  clients: [
    {
      id: 'client-a',
      detailView: 'full-app',
      unsupportedActions: 'full-app',
      createActions: ['signal'],
      spaces: [
        { slug: 'shared', framingOrigins: ['https://a.example'] },
        { slug: 'only-a', framingOrigins: ['https://a.example'] },
      ],
    },
    {
      id: 'client-b',
      spaces: [{ slug: 'shared', framingOrigins: ['https://b.example'] }],
    },
  ],
});

const run = (path: string, clientParam?: string | null) =>
  resolve('app.example', path, config(), { ...OPTIONS, clientParam });

describe('client selection in the frame', () => {
  it('the parameter is `client`', () => {
    expect(WL_CLIENT_PARAM).toBe('client');
    expect(WL_CLIENT_HEADER).toBe('x-hypha-wl-client');
  });

  it('a named client: its settings and only its origins', () => {
    expect(run('/embed/shared/en/agreements', 'client-a')).toMatchObject({
      kind: 'rewrite',
      clientId: 'client-a',
      detailView: 'full-app',
      unsupportedActions: 'full-app',
      createActions: ['signal'],
      framingOrigins: ['https://a.example'],
    });
    expect(run('/embed/shared/en/agreements', 'client-b')).toMatchObject({
      clientId: 'client-b',
      detailView: 'embedded',
      unsupportedActions: 'hide',
      createActions: [],
      framingOrigins: ['https://b.example'],
    });
  });

  it('a named client that does not approve the Space: not found', () => {
    expect(run('/embed/only-a/en/agreements', 'client-b')).toEqual({
      kind: 'not-found',
      reason: 'unapproved-space',
    });
    expect(run('/embed/shared/en/agreements', 'nobody')).toEqual({
      kind: 'not-found',
      reason: 'unapproved-space',
    });
  });

  it('only one approving client and none named: that client', () => {
    expect(run('/embed/only-a/en/agreements')).toMatchObject({
      clientId: 'client-a',
      detailView: 'full-app',
      createActions: ['signal'],
      framingOrigins: ['https://a.example'],
    });
    // An empty parameter counts as none named.
    expect(run('/embed/only-a/en/agreements', '')).toMatchObject({
      clientId: 'client-a',
    });
  });

  it('several approving clients and none named: defaults, the union of origins', () => {
    const decision = run('/embed/shared/en/agreements');
    expect(decision).toMatchObject({
      kind: 'rewrite',
      detailView: 'embedded',
      unsupportedActions: 'hide',
      createActions: [],
      clientIds: ['client-a', 'client-b'],
      framingOrigins: ['https://a.example', 'https://b.example'],
    });
    expect(decision).not.toHaveProperty('clientId');
  });

  it('a name is matched exactly (no case folding or trimming)', () => {
    for (const bad of ['Client-A', ' client-a', 'client-a ', 'client-']) {
      expect(run('/embed/shared/en/agreements', bad).kind).toBe('not-found');
    }
  });

  it('the parameter is ignored on a mapped host (the domain names the client)', () => {
    const hostConfig: WhiteLabelConfig = {
      clients: [],
      mainHosts: ['app.example'],
      hostClients: [
        {
          id: 'host-client',
          hosts: [{ host: 'space.partner.example', spaceSlug: 'shared' }],
        },
      ],
    };
    expect(
      resolve('space.partner.example', '/en/agreements', hostConfig, {
        ...OPTIONS,
        clientParam: 'client-b',
      }),
    ).toMatchObject({ kind: 'rewrite', mode: 'host', clientId: 'host-client' });
  });
});

describe('the client rides along in the frame links', () => {
  const ctx = (clientId?: string): WhiteLabelLinkContext => ({
    mode: 'embed',
    spaceSlug: 'shared',
    lang: 'en',
    ...(clientId ? { clientId } : {}),
  });

  it('withClient: sets or replaces the parameter, keeps the rest', () => {
    expect(withClient(ctx('client-a'), '')).toBe('?client=client-a');
    expect(withClient(ctx('client-a'), '?board=space')).toBe(
      '?board=space&client=client-a',
    );
    expect(withClient(ctx('client-a'), '?client=client-b&x=1')).toBe(
      '?client=client-a&x=1',
    );
  });

  it('withClient: unchanged without a selected client and on a host', () => {
    expect(withClient(ctx(), '?x=1')).toBe('?x=1');
    expect(
      withClient(
        {
          mode: 'host',
          spaceSlug: 'shared',
          lang: 'en',
          fullAppOrigin: APP,
        },
        '?x=1',
      ),
    ).toBe('?x=1');
  });

  it('section links carry it; links without a client do not change', () => {
    expect(sectionHref(ctx('client-a'), 'members')).toBe(
      '/embed/shared/en/members?client=client-a',
    );
    expect(sectionHref(ctx(), 'members')).toBe('/embed/shared/en/members');
  });

  it('classifyLink: every internal href of the frame carries it', () => {
    const c = ctx('client-a');
    const hrefs = [
      '/embed/shared/en/members',
      '/embed/shared',
      '/en/dho/shared/members',
      '/en/dho/shared',
      '/en/dho/shared/agreements/proposal/p1',
      '/embed/shared/en/agreements/proposal/p1/voters',
      '/embed/shared/en/coherence/signal/s1?order=new',
    ];
    for (const href of hrefs) {
      const decision = classifyLink(href, c, APP, ['en', 'pt']);
      expect(decision?.kind, href).toBe('internal');
      if (decision?.kind === 'internal') {
        expect(decision.href, href).toContain('client=client-a');
        expect(decision.href.match(/client=/g)).toHaveLength(1);
      }
    }
  });

  it('classifyLink: a link that names another client is rewritten to this one', () => {
    const decision = classifyLink(
      '/embed/shared/en/members?client=client-b',
      ctx('client-a'),
      APP,
      ['en', 'pt'],
    );
    expect(decision).toEqual({
      kind: 'internal',
      href: '/embed/shared/en/members?client=client-a',
    });
  });

  it('classifyLink: with no selected client the hrefs are as before', () => {
    expect(
      classifyLink('/en/dho/shared/members', ctx(), APP, ['en', 'pt']),
    ).toEqual({ kind: 'internal', href: '/embed/shared/en/members' });
  });
});
