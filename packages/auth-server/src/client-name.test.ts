import { describe, expect, it } from 'vitest';
import {
  CLIENT_NAME_MAX,
  clientNameClaim,
  parseClientNameClaim,
} from './client-name';

describe('client_name claim', () => {
  it('mints the declared name, trimmed and with whitespace collapsed', () => {
    expect(clientNameClaim('  Claude   Code ')).toBe('Claude Code');
  });

  it('mints nothing for a missing, empty or non-string name', () => {
    for (const value of [undefined, null, '', '   ', 42, {}, ['x']])
      expect(clientNameClaim(value)).toBeNull();
  });

  it('replaces control characters so the label cannot break a line or a log', () => {
    expect(clientNameClaim('Evil\nApp\u0000\u009f')).toBe('Evil App');
  });

  it('caps the name by characters, never splitting one', () => {
    const emoji = '\u{1F600}';
    const claim = clientNameClaim(emoji.repeat(CLIENT_NAME_MAX + 10))!;
    expect(Array.from(claim)).toHaveLength(CLIENT_NAME_MAX);
    expect(claim).toBe(emoji.repeat(CLIENT_NAME_MAX));
  });

  it('reading the claim from a token is lenient: anything malformed is null, never an error', () => {
    expect(parseClientNameClaim('Cursor')).toBe('Cursor');
    expect(parseClientNameClaim(undefined)).toBeNull();
    expect(parseClientNameClaim({ name: 'x' })).toBeNull();
    expect(parseClientNameClaim('a'.repeat(500))).toHaveLength(CLIENT_NAME_MAX);
  });
});
