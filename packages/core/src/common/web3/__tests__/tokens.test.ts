import { describe, expect, it } from 'vitest';
import {
  TOKENS,
  isCatalogueToken,
  isKnownTreasuryToken,
} from '../tokens';

describe('isCatalogueToken', () => {
  it('returns true for hardcoded catalogue addresses', () => {
    for (const token of TOKENS) {
      expect(isCatalogueToken(token.address)).toBe(true);
      expect(isCatalogueToken(token.address.toLowerCase())).toBe(true);
      expect(isCatalogueToken(token.address.toUpperCase())).toBe(true);
    }
  });

  it('returns false for unknown or empty addresses', () => {
    expect(isCatalogueToken('0x0000000000000000000000000000000000000001')).toBe(
      false,
    );
    expect(isCatalogueToken(null)).toBe(false);
    expect(isCatalogueToken(undefined)).toBe(false);
    expect(isCatalogueToken('')).toBe(false);
  });
});

describe('isKnownTreasuryToken', () => {
  const spam = '0x1111111111111111111111111111111111111111';
  const dbToken = '0x2222222222222222222222222222222222222222';
  const known = new Set([dbToken]);

  it('keeps catalogue tokens even when not in knownAddresses', () => {
    expect(isKnownTreasuryToken(TOKENS[0].address, new Set())).toBe(true);
  });

  it('keeps DB-known addresses', () => {
    expect(isKnownTreasuryToken(dbToken, known)).toBe(true);
  });

  it('drops unknown spam addresses', () => {
    expect(isKnownTreasuryToken(spam, known)).toBe(false);
  });
});
