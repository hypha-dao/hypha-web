import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import {
  WHITE_LABEL_CONFIG_ENV,
  WL_REQUEST_HEADERS,
  WL_SECTIONS,
  WL_TABS,
  WL_TABS_HEADER,
  isTabVisible,
  landingTab,
  parseTabs,
  parseWhiteLabelConfig,
  parseWhiteLabelHostConfig,
  readTabsHeader,
  resolve,
  serializeTabs,
  stripWhiteLabelHeaders,
  type ResolveOptions,
  type WhiteLabelConfig,
} from '..';
import { middleware } from '../../../middleware';

// next-intl cannot load under vitest; the white-label paths never call it.
vi.mock('@hypha-platform/i18n', () => ({
  middleware: () => new Response(null),
  routing: { locales: ['en', 'pt'], defaultLocale: 'en' },
}));

const OPTIONS: ResolveOptions = { locales: ['en', 'pt'], defaultLocale: 'en' };

const embed = (extra: string) =>
  parseWhiteLabelConfig(
    `[{"id":"c1"${extra},"spaces":[{"slug":"s1","framingOrigins":["https://partner.example"]}]}]`,
  ).clients[0];
const host = (extra: string) =>
  parseWhiteLabelHostConfig(
    `[{"id":"c1"${extra},"hosts":[{"host":"space.partner.example","space":"s1"}]}]`,
  )[0];

describe('tabs in the config', () => {
  it('the tabs are the nav sections in product order, banking is not one', () => {
    expect(WL_TABS).toEqual([
      'overview',
      'energy',
      'agreements',
      'members',
      'treasury',
      'coherence',
      'pipeline',
      'memory',
      'calendar',
      'rewards',
      'ecosystem-navigation',
    ]);
    for (const tab of WL_TABS) expect(WL_SECTIONS).toContain(tab);
    expect(WL_TABS).not.toContain('banking');
  });

  it('absent stays absent (all tabs at resolve time)', () => {
    expect(embed('')).not.toHaveProperty('tabs');
    expect(host('')).not.toHaveProperty('tabs');
    expect(parseTabs(undefined)).toEqual({});
  });

  it('keeps the client order, in both configs, without duplicates', () => {
    const value = ',"tabs":["members","overview","members","calendar"]';
    expect(embed(value)?.tabs).toEqual(['members', 'overview', 'calendar']);
    expect(host(value)?.tabs).toEqual(['members', 'overview', 'calendar']);
  });

  it('drops unknown and non-string entries (banking is not a tab)', () => {
    const value =
      ',"tabs":["Overview","banking","settings",1,null,"members"," members","treasury"]';
    expect(embed(value)?.tabs).toEqual(['members', 'treasury']);
    expect(host(value)?.tabs).toEqual(['members', 'treasury']);
  });

  it('fails open: invalid, empty or all-unknown means not set (all tabs)', () => {
    for (const bad of [
      '"members"',
      'true',
      '1',
      'null',
      '{}',
      '""',
      '[]',
      '["settings","banking",3]',
    ]) {
      expect(embed(`,"tabs":${bad}`), bad).not.toHaveProperty('tabs');
      expect(host(`,"tabs":${bad}`), bad).not.toHaveProperty('tabs');
    }
  });
});

describe('isTabVisible and landingTab', () => {
  it('absent means all; a list shows only its tabs', () => {
    expect(isTabVisible(undefined, 'members')).toBe(true);
    expect(isTabVisible(['members'], 'members')).toBe(true);
    expect(isTabVisible(['members'], 'treasury')).toBe(false);
  });

  it('banking follows treasury', () => {
    expect(isTabVisible(['treasury'], 'banking')).toBe(true);
    expect(isTabVisible(['members'], 'banking')).toBe(false);
  });

  it('what is not a tab is not decided here', () => {
    expect(isTabVisible(['members'], 'unknown-thing')).toBe(true);
    expect(isTabVisible(['members'], 'proposal')).toBe(true);
  });

  it('the landing is the first listed tab, overview for all', () => {
    expect(landingTab(['members', 'overview'])).toBe('members');
    expect(landingTab(undefined)).toBe('overview');
  });
});

describe('tabs on the resolver result', () => {
  const hostConfig = (tabs?: string): WhiteLabelConfig => ({
    clients: [],
    hostClients: parseWhiteLabelHostConfig(
      `[{"id":"c1"${
        tabs ? `,"tabs":${tabs}` : ''
      },"hosts":[{"host":"space.partner.example","space":"s1"}]}]`,
    ),
    mainHosts: ['app.example'],
  });
  const embedConfig = (...lists: (string | undefined)[]): WhiteLabelConfig => ({
    clients: lists.map((tabs, i) => ({
      ...parseWhiteLabelConfig(
        `[{"id":"c${i}"${
          tabs ? `,"tabs":${tabs}` : ''
        },"spaces":[{"slug":"s1","framingOrigins":["https://p${i}.example"]}]}]`,
      ).clients[0]!,
    })),
    hostClients: [],
    mainHosts: [],
  });

  const onHost = (config: WhiteLabelConfig, path: string) =>
    resolve('space.partner.example', path, config, OPTIONS);
  const onFrame = (config: WhiteLabelConfig, path: string, client?: string) =>
    resolve('app.example', path, config, { ...OPTIONS, clientParam: client });

  it('default: all tabs in product order, landing overview', () => {
    const d = onHost(hostConfig(), '/');
    expect(d).toMatchObject({
      kind: 'rewrite',
      pathname: '/wl/s1/en/overview',
      tabs: [...WL_TABS],
    });
  });

  it('host: the client list and order, the landing is the first listed', () => {
    const config = hostConfig('["members","overview"]');
    expect(onHost(config, '/')).toMatchObject({
      pathname: '/wl/s1/en/members',
      tabs: ['members', 'overview'],
    });
    expect(onHost(config, '/pt')).toMatchObject({
      pathname: '/wl/s1/pt/members',
    });
    expect(onHost(config, '/en/overview')).toMatchObject({
      pathname: '/wl/s1/en/overview',
    });
  });

  it('a hidden tab is tab-hidden: pages, details, overlays, create pages, banking', () => {
    const config = hostConfig('["members","overview"]');
    for (const path of [
      '/treasury',
      '/en/treasury',
      '/en/banking',
      '/en/agreements',
      '/en/agreements/proposal/p1',
      '/en/agreements/proposal/p1/voters',
      '/en/agreements/select-create-action',
      '/en/agreements/create/propose-contribution',
      '/en/coherence/signal/s1',
      '/en/coherence/new-signal',
      '/en/pipeline/track/t1',
      '/pt/energy',
    ]) {
      expect(onHost(config, path), path).toEqual({
        kind: 'not-found',
        reason: 'tab-hidden',
      });
    }
  });

  it('an explicit /overview is a 404 when overview is hidden; the landing is not', () => {
    const config = hostConfig('["members"]');
    expect(onHost(config, '/overview')).toEqual({
      kind: 'not-found',
      reason: 'tab-hidden',
    });
    expect(onHost(config, '/')).toMatchObject({
      pathname: '/wl/s1/en/members',
    });
  });

  it('banking is served when treasury is visible', () => {
    expect(onHost(hostConfig('["treasury"]'), '/en/banking')).toMatchObject({
      kind: 'rewrite',
      pathname: '/wl/s1/en/banking',
    });
  });

  it('what is not a section stays as before (the catch-all answers it)', () => {
    expect(
      onHost(hostConfig('["members"]'), '/en/something-else'),
    ).toMatchObject({ kind: 'rewrite', pathname: '/wl/s1/en/something-else' });
  });

  it('frame: the selected client; two clients, none named, means all tabs', () => {
    const config = embedConfig('["members"]', '["treasury","overview"]');
    expect(onFrame(config, '/embed/s1/en', 'c1')).toMatchObject({
      pathname: '/wl/s1/en/treasury',
      tabs: ['treasury', 'overview'],
    });
    expect(onFrame(config, '/embed/s1/en/members', 'c1')).toEqual({
      kind: 'not-found',
      reason: 'tab-hidden',
    });
    expect(onFrame(config, '/embed/s1/en')).toMatchObject({
      pathname: '/wl/s1/en/overview',
      tabs: [...WL_TABS],
    });
    expect(
      onFrame(embedConfig('["members"]'), '/embed/s1/en/treasury'),
    ).toEqual({ kind: 'not-found', reason: 'tab-hidden' });
  });

  it('createActions is independent of tabs (not filtered)', () => {
    const config: WhiteLabelConfig = {
      clients: [],
      mainHosts: ['app.example'],
      hostClients: parseWhiteLabelHostConfig(
        '[{"id":"c1","tabs":["members"],"createActions":["signal","agreement"],"hosts":[{"host":"space.partner.example","space":"s1","authConfig":{"privyClientId":"client-1","cookieDomain":"partner.example"}}]}]',
      ),
    };
    expect(onHost(config, '/en/members')).toMatchObject({
      createActions: ['signal', 'agreement'],
      tabs: ['members'],
    });
  });
});

describe('tabs header', () => {
  it('is stripped from inbound requests', () => {
    expect(WL_REQUEST_HEADERS).toContain(WL_TABS_HEADER);
    const headers = new Headers({ [WL_TABS_HEADER]: 'members' });
    expect(stripWhiteLabelHeaders(headers).has(WL_TABS_HEADER)).toBe(false);
  });

  it('round-trips, keeping the order', () => {
    expect(readTabsHeader(serializeTabs(['members', 'overview']))).toEqual([
      'members',
      'overview',
    ]);
  });

  it('fails open: no header, empty or unknown means all tabs', () => {
    for (const raw of [null, undefined, '', 'settings,banking', ' , ']) {
      expect(readTabsHeader(raw), String(raw)).toEqual([...WL_TABS]);
    }
    expect(readTabsHeader('treasury, bogus ,treasury')).toEqual(['treasury']);
  });
});

describe('middleware: tabs', () => {
  const saved = process.env[WHITE_LABEL_CONFIG_ENV];
  beforeEach(() => {
    process.env[WHITE_LABEL_CONFIG_ENV] = JSON.stringify([
      {
        id: 'client-a',
        tabs: ['members', 'overview'],
        spaces: [{ slug: 'one', framingOrigins: ['https://a.example'] }],
      },
    ]);
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[WHITE_LABEL_CONFIG_ENV];
    else process.env[WHITE_LABEL_CONFIG_ENV] = saved;
  });

  const get = (path: string, headers?: Record<string, string>) =>
    middleware(
      new NextRequest(new URL(path, 'https://app.example'), { headers }),
    );
  const forwarded = (response: Response, name: string) =>
    response.headers.get(`x-middleware-request-${name}`);

  it('sets the header from the decision and serves the landing', () => {
    const response = get('/embed/one/en');
    expect(forwarded(response, WL_TABS_HEADER)).toBe('members,overview');
    expect(response.headers.get('x-middleware-rewrite')).toContain(
      '/wl/one/en/members',
    );
  });

  it('a visitor-sent header is replaced', () => {
    const response = get('/embed/one/en/overview', {
      [WL_TABS_HEADER]: 'treasury',
    });
    expect(forwarded(response, WL_TABS_HEADER)).toBe('members,overview');
  });

  it('a hidden tab is not rewritten (the white-label 404)', () => {
    const response = get('/embed/one/en/treasury');
    expect(forwarded(response, WL_TABS_HEADER)).toBeNull();
    expect(response.headers.get('x-middleware-rewrite') ?? '').not.toContain(
      '/wl/one/en/treasury',
    );
  });
});
