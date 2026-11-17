import { describe, it, expect } from 'vitest';
import { describeClient } from './client-copy';

const text = (segments: { text: string }[]) =>
  segments.map((s) => s.text).join('');
const strong = (segments: { text: string; strong?: boolean }[]) =>
  segments.filter((s) => s.strong).map((s) => s.text);

describe('consent copy tells a proven domain from a claimed name', () => {
  const base = {
    name: 'Some App',
    host: 'claude.ai',
    redirectHost: 'localhost',
  };

  it('CIMD: shows the proven host and says the rest is unchecked', () => {
    const c = describeClient({ ...base, kind: 'cimd' });
    expect(strong(c)).toEqual(['claude.ai', 'Some App', 'localhost']);
    expect(text(c)).toMatch(/not approved/);
    expect(text(c)).toMatch(/address is real/);
    expect(text(c)).toMatch(/Nothing else about the app has been checked/);
  });

  it('DCR: the name is a claim, no host is presented as identity', () => {
    const c = describeClient({ ...base, kind: 'dcr', host: '' });
    expect(strong(c)).toEqual(['Some App', 'localhost']);
    expect(text(c)).toMatch(/registered itself and chose its own name/);
    expect(text(c)).toMatch(/not checked/);
    expect(text(c)).not.toMatch(/address is real/);
  });

  it('a DCR client that supplies a host still gets none shown', () => {
    const c = describeClient({ ...base, kind: 'dcr' });
    expect(text(c)).not.toContain('claude.ai');
  });

  it('registered keeps the existing wording', () => {
    const c = describeClient({ ...base, kind: 'registered' });
    expect(text(c)).toMatch(
      /^Hypha has not verified this app\. It calls itself/,
    );
  });

  it('the name is plain text: markup stays as characters, never as structure', () => {
    const c = describeClient({
      ...base,
      kind: 'dcr',
      name: '<img src=x onerror=alert(1)>',
    });
    expect(c.every((s) => typeof s.text === 'string')).toBe(true);
    expect(strong(c)).toContain('<img src=x onerror=alert(1)>');
  });
});

describe('hosts are shown whole', () => {
  it('a 150-character host is never cut', () => {
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
    expect(c.filter((s) => s.strong).map((s) => s.text)).toEqual(
      expect.arrayContaining([host]),
    );
    expect(c.map((s) => s.text).join('')).not.toContain('...');
  });
});
