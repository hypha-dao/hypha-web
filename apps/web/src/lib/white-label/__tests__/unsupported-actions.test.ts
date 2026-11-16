import { describe, expect, it } from 'vitest';

import {
  WL_REQUEST_HEADERS,
  WL_UNSUPPORTED_ACTIONS_HEADER,
  classifyLink,
  isCreateFlow,
  parseUnsupportedActions,
  parseWhiteLabelConfig,
  parseWhiteLabelHostConfig,
  resolve,
  stripWhiteLabelHeaders,
  type ResolveOptions,
  type UnsupportedActions,
  type WhiteLabelConfig,
  type WhiteLabelLinkContext,
} from '..';

const OPTIONS: ResolveOptions = {
  locales: ['en', 'pt', 'es', 'fr', 'de'],
  defaultLocale: 'en',
};
const locales = OPTIONS.locales;
const app = 'https://app.example';
const here = 'https://space.partner.example';

describe('unsupportedActions in the config', () => {
  const embed = (extra: string) =>
    parseWhiteLabelConfig(
      `[{"id":"c1"${extra},"spaces":[{"slug":"s1","framingOrigins":["https://partner.example"]}]}]`,
    ).clients[0];
  const host = (extra: string) =>
    parseWhiteLabelHostConfig(
      `[{"id":"c1"${extra},"hosts":[{"host":"space.partner.example","space":"s1"}]}]`,
    )[0];

  it('absent stays absent (hide applies at resolve time)', () => {
    expect(embed('')).not.toHaveProperty('unsupportedActions');
    expect(host('')).not.toHaveProperty('unsupportedActions');
    expect(parseUnsupportedActions(undefined)).toEqual({});
  });

  it('accepts the two values, in both configs', () => {
    expect(embed(',"unsupportedActions":"hide"')?.unsupportedActions).toBe(
      'hide',
    );
    expect(embed(',"unsupportedActions":"full-app"')?.unsupportedActions).toBe(
      'full-app',
    );
    expect(host(',"unsupportedActions":"full-app"')?.unsupportedActions).toBe(
      'full-app',
    );
  });

  it('fails closed: any other value hides', () => {
    for (const bad of [
      '"Full-App"',
      '"show"',
      '""',
      'true',
      '1',
      'null',
      '[]',
    ]) {
      expect(embed(`,"unsupportedActions":${bad}`)?.unsupportedActions).toBe(
        'hide',
      );
      expect(host(`,"unsupportedActions":${bad}`)?.unsupportedActions).toBe(
        'hide',
      );
    }
  });
});

describe('unsupportedActions on the resolver result', () => {
  const embedConfig = (
    ...values: (UnsupportedActions | undefined)[]
  ): WhiteLabelConfig => ({
    clients: values.map((value, i) => ({
      id: `c${i}`,
      ...(value ? { unsupportedActions: value } : {}),
      spaces: [{ slug: 's1', framingOrigins: ['https://partner.example'] }],
    })),
    hostClients: [],
    mainHosts: [],
  });
  const hostConfig = (value?: UnsupportedActions): WhiteLabelConfig => ({
    clients: [],
    mainHosts: ['app.example'],
    hostClients: [
      {
        id: 'c1',
        ...(value ? { unsupportedActions: value } : {}),
        hosts: [{ host: 'space.partner.example', spaceSlug: 's1' }],
      },
    ],
  });
  const result = (host: string, path: string, config: WhiteLabelConfig) => {
    const decision = resolve(host, path, config, OPTIONS);
    return decision.kind === 'rewrite' ? decision.unsupportedActions : null;
  };

  it('host: the owning client value, hide when unset', () => {
    expect(result('space.partner.example', '/', hostConfig())).toBe('hide');
    expect(result('space.partner.example', '/', hostConfig('hide'))).toBe(
      'hide',
    );
    expect(result('space.partner.example', '/', hostConfig('full-app'))).toBe(
      'full-app',
    );
  });

  it('embed: hide wins across approving clients, unset counts as hide', () => {
    const path = '/embed/s1';
    expect(result('app.example', path, embedConfig('full-app'))).toBe(
      'full-app',
    );
    expect(result('app.example', path, embedConfig(undefined))).toBe('hide');
    expect(
      result('app.example', path, embedConfig('full-app', 'full-app')),
    ).toBe('full-app');
    expect(result('app.example', path, embedConfig('full-app', 'hide'))).toBe(
      'hide',
    );
    expect(
      result('app.example', path, embedConfig('full-app', undefined)),
    ).toBe('hide');
  });

  it('the request header is stripped on the way in', () => {
    expect(WL_REQUEST_HEADERS).toContain(WL_UNSUPPORTED_ACTIONS_HEADER);
    const headers = new Headers({
      [WL_UNSUPPORTED_ACTIONS_HEADER]: 'full-app',
    });
    expect(
      stripWhiteLabelHeaders(headers).has(WL_UNSUPPORTED_ACTIONS_HEADER),
    ).toBe(false);
  });
});

describe('create-flow position', () => {
  it('reads only the segment after the section', () => {
    expect(isCreateFlow(['agreements', 'select-create-action'])).toBe(true);
    expect(isCreateFlow(['agreements', 'create', 'pay-for-expenses'])).toBe(
      true,
    );
    expect(isCreateFlow(['treasury', 'create', 'issue-new-token'])).toBe(true);
    expect(isCreateFlow(['coherence', 'new-signal'])).toBe(true);
    expect(isCreateFlow(['memory', 'new-memory'])).toBe(true);
    expect(isCreateFlow(['calendar', 'new-scheduled-item'])).toBe(true);
    expect(isCreateFlow(['calendar', 'edit-scheduled-item', 'i1'])).toBe(true);
    expect(isCreateFlow(['space', 'create'])).toBe(true);
    // slugs that look like markers are details, not create flows
    expect(isCreateFlow(['agreements', 'proposal', 'create'])).toBe(false);
    expect(isCreateFlow(['coherence', 'signal', 'new-signal'])).toBe(false);
    expect(isCreateFlow(['members'])).toBe(false);
  });
});

describe('link guard: create flows by delivery and setting', () => {
  const hostCtx = (
    unsupportedActions?: UnsupportedActions,
  ): WhiteLabelLinkContext => ({
    mode: 'host',
    spaceSlug: 's1',
    lang: 'en',
    fullAppOrigin: app,
    ...(unsupportedActions ? { unsupportedActions } : {}),
  });
  const embedCtx = (
    unsupportedActions?: UnsupportedActions,
  ): WhiteLabelLinkContext => ({
    mode: 'embed',
    spaceSlug: 's1',
    lang: 'en',
    ...(unsupportedActions ? { unsupportedActions } : {}),
  });

  const mainShaped = [
    '/en/dho/s1/agreements/select-create-action',
    '/en/dho/s1/agreements/create/issue-new-token',
    '/en/dho/s1/treasury/create/token-backing-vault?hideBack=true',
    '/en/dho/s1/memory/new-memory',
    '/en/dho/s1/coherence/new-signal',
    '/en/dho/s1/calendar/new-scheduled-item?allDay=0',
  ];

  it('blocked by default, in both deliveries and for a missing setting', () => {
    for (const href of mainShaped) {
      expect(classifyLink(href, hostCtx(), here, locales), href).toEqual({
        kind: 'blocked',
      });
      expect(classifyLink(href, hostCtx('hide'), here, locales)).toEqual({
        kind: 'blocked',
      });
      expect(classifyLink(href, embedCtx(), here, locales)).toEqual({
        kind: 'blocked',
      });
    }
  });

  it('full-app: leaves to the same page of the full app, as before', () => {
    for (const href of mainShaped) {
      expect(classifyLink(href, hostCtx('full-app'), here, locales)).toEqual({
        kind: 'external',
        href: `${app}${href}`,
      });
      expect(classifyLink(href, embedCtx('full-app'), here, locales)).toEqual({
        kind: 'external',
        href,
      });
    }
  });

  it('host-shaped and embed-shaped create links are blocked, or mapped to the full app', () => {
    expect(
      classifyLink('/en/agreements/create/x', hostCtx(), here, locales),
    ).toEqual({ kind: 'blocked' });
    expect(
      classifyLink(
        '/pt/agreements/create/x',
        hostCtx('full-app'),
        here,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: `${app}/pt/dho/s1/agreements/create/x`,
    });
    expect(
      classifyLink('/embed/s1/en/memory/new-memory', embedCtx(), here, locales),
    ).toEqual({ kind: 'blocked' });
    expect(
      classifyLink(
        '/embed/s1/en/memory/new-memory',
        embedCtx('full-app'),
        here,
        locales,
      ),
    ).toEqual({ kind: 'external', href: '/en/dho/s1/memory/new-memory' });
  });

  it('keeps the link locale in the full-app link (3.3 rule)', () => {
    expect(
      classifyLink(
        '/de/dho/s1/agreements/create/x',
        { ...hostCtx('full-app'), lang: 'en' },
        here,
        locales,
      ),
    ).toEqual({
      kind: 'external',
      href: `${app}/de/dho/s1/agreements/create/x`,
    });
  });

  it('a Space whose slug looks like a create marker is not a create flow', () => {
    for (const setting of [undefined, 'hide', 'full-app'] as const) {
      const ctx = { ...hostCtx(setting), spaceSlug: 'create' };
      expect(
        classifyLink('/en/dho/create/agreements', ctx, here, locales),
      ).toEqual({ kind: 'internal', href: '/en/agreements' });
      expect(isCreateFlow(['dho', 'create', 'agreements'])).toBe(false);
    }
    // a real create flow of that Space is still a create flow
    expect(
      classifyLink(
        '/en/dho/create/agreements/create/x',
        { ...hostCtx(), spaceSlug: 'create' },
        here,
        locales,
      ),
    ).toEqual({ kind: 'blocked' });
  });

  it('other links are unchanged by the setting', () => {
    for (const setting of [undefined, 'hide', 'full-app'] as const) {
      const ctx = hostCtx(setting);
      expect(
        classifyLink(
          '/en/dho/s1/agreements/proposal/new-memory',
          ctx,
          here,
          locales,
        ),
      ).toMatchObject({ kind: 'internal' });
      expect(classifyLink('/en/dho/s1/settings', ctx, here, locales)).toEqual({
        kind: 'external',
        href: `${app}/en/dho/s1/settings`,
      });
      expect(
        classifyLink('/en/dho/other/overview', ctx, here, locales),
      ).toEqual({ kind: 'external', href: `${app}/en/dho/other/overview` });
      expect(classifyLink('/en/agreements', ctx, here, locales)).toMatchObject({
        kind: 'internal',
      });
    }
  });
});
