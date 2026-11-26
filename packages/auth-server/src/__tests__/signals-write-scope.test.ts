import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALWAYS_UNTICKED_SCOPES,
  API_RESOURCE_SCOPES,
  AUTH_SERVER_SCOPES,
  AUTH_SERVER_WRITE_SCOPES,
  DCR_ALLOWED_SCOPES,
  SCOPES_REQUIRING_SPACES_READ,
  allowedScopesForResource,
  channelForResource,
  loadAuthServerConfig,
  scopesForChannel,
} from '../config';
import { describeScope } from '../scope-copy';
import { withImpliedScopes } from '../auth';

const MCP = 'https://mcp.example.com/mcp';
const API = 'https://api.example.com/v2';
const off = { mcpWritesEnabled: false };
const on = { mcpWritesEnabled: true };

describe('signals:write in the scope vocabulary', () => {
  it('is issued by the server, is a write scope, and starts unticked for every client', () => {
    expect(AUTH_SERVER_SCOPES).toContain('signals:write');
    expect(AUTH_SERVER_WRITE_SCOPES).toContain('signals:write');
    expect(ALWAYS_UNTICKED_SCOPES).toEqual(['signals:write']);
    expect(SCOPES_REQUIRING_SPACES_READ).toEqual(['signals:write']);
  });

  it('dynamic registration keeps its previous scope list (no signals:write)', () => {
    expect([...DCR_ALLOWED_SCOPES]).toEqual([
      'spaces:read',
      'agreements:vote',
      'offline_access',
    ]);
  });

  it('has its own consent copy with the stronger warning', () => {
    expect(describeScope('signals:write')).toEqual({
      key: 'signalsWrite',
      hasWarning: true,
    });
  });
});

describe('allowed scopes per channel', () => {
  it('the /mcp resource is the MCP channel; every other resource is the API', () => {
    expect(channelForResource(MCP)).toBe('mcp');
    expect(channelForResource(`${MCP}/`)).toBe('api');
    expect(channelForResource(API)).toBe('api');
    expect(channelForResource('not a url')).toBe('api');
  });

  it('MCP accepts reads only while MCP writes are off', () => {
    expect(allowedScopesForResource(MCP, off)).toEqual([
      'spaces:read',
      'offline_access',
    ]);
  });

  it('MCP accepts signals:write only while MCP writes are on', () => {
    expect(allowedScopesForResource(MCP, on)).toEqual([
      'spaces:read',
      'offline_access',
      'signals:write',
    ]);
  });

  it('the API keeps what it accepted before, never signals:write, whatever the switch', () => {
    for (const options of [off, on]) {
      expect(allowedScopesForResource(API, options)).toEqual([
        'spaces:read',
        'agreements:vote',
        'offline_access',
      ]);
      expect(scopesForChannel('api', options)).not.toContain('signals:write');
    }
    expect([...API_RESOURCE_SCOPES].sort()).toEqual(
      AUTH_SERVER_SCOPES.filter((s) => s !== 'signals:write').sort(),
    );
  });

  it('returns a fresh list each call (callers cannot change the declaration)', () => {
    const first = allowedScopesForResource(MCP, on);
    first.push('agreements:vote');
    expect(allowedScopesForResource(MCP, on)).not.toContain('agreements:vote');
  });
});

describe('MCP_WRITES_ENABLED', () => {
  const base = {
    AUTH_SERVER_ENABLED: 'true',
    AUTH_SERVER_ISSUER: 'https://auth.example.com',
    AUTH_SERVER_SECRET: 'x'.repeat(40),
    DEFAULT_DB_URL: 'postgres://localhost/test',
    NEXT_PUBLIC_PRIVY_APP_ID: 'app',
  };
  const writes = (value: string | undefined) => {
    const config = loadAuthServerConfig({ ...base, MCP_WRITES_ENABLED: value });
    if (!config.enabled) throw new Error(config.reason);
    return config.mcpWritesEnabled;
  };

  it('is off by default and only the exact string "true" turns it on', () => {
    for (const value of [undefined, '', '1', 'TRUE', 'yes', ' true'])
      expect(writes(value)).toBe(false);
    expect(writes('true')).toBe(true);
  });

  it('does not turn the server on by itself', () => {
    expect(
      loadAuthServerConfig({
        ...base,
        AUTH_SERVER_ENABLED: undefined,
        MCP_WRITES_ENABLED: 'true',
      }).enabled,
    ).toBe(false);
  });
});

describe('withImpliedScopes (first authorize request)', () => {
  it('adds offline_access as before', () => {
    expect(withImpliedScopes(['spaces:read'])).toEqual([
      'spaces:read',
      'offline_access',
    ]);
  });

  it('adds spaces:read next to signals:write so the space picker can show', () => {
    expect(withImpliedScopes(['signals:write'])).toEqual([
      'signals:write',
      'spaces:read',
      'offline_access',
    ]);
  });

  it('adds nothing twice and keeps the order of what was asked', () => {
    expect(
      withImpliedScopes(['offline_access', 'signals:write', 'spaces:read']),
    ).toEqual(['offline_access', 'signals:write', 'spaces:read']);
  });

  it('does not add spaces:read to a request without a scope that needs it', () => {
    expect(withImpliedScopes(['agreements:vote'])).toEqual([
      'agreements:vote',
      'offline_access',
    ]);
  });
});

describe('consent text of signals:write', () => {
  const LOCALES = ['de', 'en', 'es', 'fr', 'mk', 'nl', 'no', 'pt'] as const;
  const read = (locale: string) => {
    const consent = JSON.parse(
      readFileSync(
        new URL(`../../../i18n/src/messages/${locale}.json`, import.meta.url),
        'utf8',
      ),
    ).AuthServer.consent;
    return {
      ...(consent.scopes.signalsWrite as {
        title: string;
        detail: string;
        warning: string;
      }),
      picker: consent.spaces.titleWithWrite as string,
    };
  };

  it('English says what it can and cannot do, and that it is not selected by default', () => {
    const { title, detail, warning, picker } = read('en');
    expect(title).toMatch(/signals/i);
    expect(detail).toMatch(/spaces you choose/i);
    expect(detail).toMatch(/in your name/i);
    expect(detail).toMatch(/cannot edit or delete/i);
    expect(detail).toMatch(/not selected unless you tick it/i);
    expect(warning).toMatch(/has not approved this app/i);
    expect(picker).toMatch(/post signals/i);
  });

  it('every locale carries its own title, detail, warning and picker title', () => {
    const english = read('en');
    for (const locale of LOCALES) {
      const copy = read(locale);
      for (const key of ['title', 'detail', 'warning', 'picker'] as const) {
        expect(copy[key].length, `${locale}.${key}`).toBeGreaterThan(0);
        if (locale !== 'en')
          expect(copy[key], `${locale}.${key}`).not.toBe(english[key]);
      }
      expect(copy.detail.length).toBeGreaterThan(80);
    }
  });
});
