import { describe, it, expect } from 'vitest';
import { describeClient } from '../client-copy';
import { describeScope } from '../scope-copy';

describe('consent copy keys tell a proven domain from a claimed name', () => {
  const base = {
    name: 'Some App',
    host: 'claude.ai',
    redirectHost: 'localhost',
  };

  it('CIMD: the proven-host message with the host', () => {
    const c = describeClient({ ...base, kind: 'cimd' });
    expect(c.key).toBe('cimd');
    expect(c.values).toEqual(base);
  });

  it('DCR: the claimed-name message, never a host (even if one is passed)', () => {
    const c = describeClient({ ...base, kind: 'dcr' });
    expect(c.key).toBe('dcr');
    expect(c.values.host).toBe('');
    expect(c.values.name).toBe('Some App');
    expect(describeClient({ ...base, kind: 'dcr', host: '' }).key).toBe('dcr');
  });

  it('registered: with the app host when it has one, without otherwise', () => {
    expect(describeClient({ ...base, kind: 'registered' }).key).toBe(
      'registeredWithHost',
    );
    expect(describeClient({ ...base, kind: 'registered', host: '' }).key).toBe(
      'registered',
    );
  });

  it('a 150-character host is passed on whole', () => {
    const host = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(
      20,
    )}.example.com`;
    expect(host.length).toBeGreaterThan(150);
    const c = describeClient({
      kind: 'cimd',
      name: 'Some App',
      host,
      redirectHost: host,
    });
    expect(c.values.host).toBe(host);
    expect(c.values.redirectHost).toBe(host);
  });
});

describe('scope copy keys', () => {
  it('maps the known scopes; only the write scope has a warning entry', () => {
    expect(describeScope('spaces:read')).toEqual({
      key: 'spacesRead',
      hasWarning: false,
    });
    expect(describeScope('agreements:vote')).toEqual({
      key: 'agreementsVote',
      hasWarning: true,
    });
    expect(describeScope('offline_access').key).toBe('offlineAccess');
  });

  it('an unknown scope is flagged, not given someone else words', () => {
    expect(describeScope('constructor')).toEqual({
      key: 'unknown',
      hasWarning: false,
    });
  });
});
