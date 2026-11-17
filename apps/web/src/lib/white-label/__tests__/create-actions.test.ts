import { describe, expect, it } from 'vitest';

import {
  CREATE_ACTIONS,
  WL_CREATE_ACTIONS_HEADER,
  WL_REQUEST_HEADERS,
  parseCreateActions,
  parseWhiteLabelConfig,
  parseWhiteLabelHostConfig,
  readCreateActionsHeader,
  resolve,
  serializeCreateActions,
  stripWhiteLabelHeaders,
  type ResolveOptions,
  type WhiteLabelConfig,
} from '..';

const OPTIONS: ResolveOptions = {
  locales: ['en', 'pt'],
  defaultLocale: 'en',
};

const embed = (extra: string) =>
  parseWhiteLabelConfig(
    `[{"id":"c1"${extra},"spaces":[{"slug":"s1","framingOrigins":["https://partner.example"]}]}]`,
  ).clients[0];
const host = (extra: string) =>
  parseWhiteLabelHostConfig(
    `[{"id":"c1"${extra},"hosts":[{"host":"space.partner.example","space":"s1"}]}]`,
  )[0];

describe('createActions in the config', () => {
  it('absent stays absent (none applies at resolve time)', () => {
    expect(embed('')).not.toHaveProperty('createActions');
    expect(host('')).not.toHaveProperty('createActions');
    expect(parseCreateActions(undefined)).toEqual({});
  });

  it('keeps the known values, in both configs, without duplicates', () => {
    const value = ',"createActions":["signal","agreement","signal"]';
    expect(embed(value)?.createActions).toEqual(['signal', 'agreement']);
    expect(host(value)?.createActions).toEqual(['signal', 'agreement']);
    expect(CREATE_ACTIONS).toEqual(['signal', 'agreement', 'contribution']);
  });

  it('drops unknown and non-string entries, never widens', () => {
    const value =
      ',"createActions":["Signal","proposal","pay-for-expenses",1,null,"contribution"," signal"]';
    expect(embed(value)?.createActions).toEqual(['contribution']);
    expect(host(value)?.createActions).toEqual(['contribution']);
  });

  it('fails closed: anything but an array is none', () => {
    for (const bad of ['"signal"', 'true', '1', 'null', '{}', '""']) {
      expect(embed(`,"createActions":${bad}`)?.createActions).toEqual([]);
      expect(host(`,"createActions":${bad}`)?.createActions).toEqual([]);
    }
  });
});

describe('createActions on the resolver result', () => {
  const hostConfig = (login: boolean, actions?: string): WhiteLabelConfig => ({
    clients: [],
    hostClients: parseWhiteLabelHostConfig(
      `[{"id":"c1"${
        actions ? `,"createActions":${actions}` : ''
      },"hosts":[{"host":"space.partner.example","space":"s1"${
        login
          ? ',"authConfig":{"privyClientId":"client-1","cookieDomain":"partner.example"}'
          : ''
      }}]}]`,
    ),
    mainHosts: ['app.example'],
  });

  const pick = (config: WhiteLabelConfig, h: string, path: string) => {
    const d = resolve(h, path, config, OPTIONS);
    return d.kind === 'rewrite' ? d.createActions : 'not-rewrite';
  };

  it('a host with login gets its client list', () => {
    const config = hostConfig(true, '["signal","contribution"]');
    expect(config.hostClients[0]?.hosts[0]?.authConfig).toBeDefined();
    expect(pick(config, 'space.partner.example', '/agreements')).toEqual([
      'signal',
      'contribution',
    ]);
  });

  it('a host without login gets none, whatever the client lists', () => {
    const config = hostConfig(false, '["signal","agreement"]');
    expect(pick(config, 'space.partner.example', '/agreements')).toEqual([]);
  });

  it('a host with login and no list gets none', () => {
    const config = hostConfig(true);
    expect(pick(config, 'space.partner.example', '/agreements')).toEqual([]);
  });

  const embedConfig = (
    ...lists: (string[] | undefined)[]
  ): WhiteLabelConfig => ({
    clients: lists.map((list, i) => ({
      id: `c${i}`,
      ...(list ? { createActions: list as never } : {}),
      spaces: [{ slug: 's1', framingOrigins: ['https://p.example'] }],
    })),
    hostClients: [],
    mainHosts: [],
  });

  it('embed: the intersection of the approving clients wins', () => {
    const config = embedConfig(
      ['signal', 'agreement'],
      ['agreement', 'contribution'],
    );
    expect(pick(config, 'app.example', '/embed/s1/en/agreements')).toEqual([
      'agreement',
    ]);
  });

  it('embed: one client with none empties it; a single client keeps its list', () => {
    expect(
      pick(
        embedConfig(['signal'], undefined),
        'app.example',
        '/embed/s1/en/agreements',
      ),
    ).toEqual([]);
    expect(
      pick(embedConfig(['signal']), 'app.example', '/embed/s1/en/agreements'),
    ).toEqual(['signal']);
  });
});

describe('createActions header', () => {
  it('is stripped from inbound requests', () => {
    expect(WL_REQUEST_HEADERS).toContain(WL_CREATE_ACTIONS_HEADER);
    const headers = new Headers({ [WL_CREATE_ACTIONS_HEADER]: 'signal' });
    expect(stripWhiteLabelHeaders(headers).has(WL_CREATE_ACTIONS_HEADER)).toBe(
      false,
    );
  });

  it('round-trips and fails closed on anything else', () => {
    expect(
      readCreateActionsHeader(serializeCreateActions(['signal', 'agreement'])),
    ).toEqual(['signal', 'agreement']);
    expect(readCreateActionsHeader(null)).toEqual([]);
    expect(readCreateActionsHeader('')).toEqual([]);
    expect(readCreateActionsHeader('*,all,proposal,Signal')).toEqual([]);
    expect(readCreateActionsHeader(' contribution , signal,signal')).toEqual([
      'contribution',
      'signal',
    ]);
  });
});
