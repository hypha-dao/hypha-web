import { describe, expect, it } from 'vitest';
import {
  TOKENS,
  HYPHA_PRICE_USD,
  HYPHA_TOKEN_ADDRESS,
  EPARTS_PRICE_EUR,
  EPARTS_REFERENCE_CURRENCY,
  EPARTS_TOKEN_ADDRESS,
  isCatalogueToken,
  isEpartsToken,
  isHyphaToken,
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

describe('HYPHA pricing', () => {
  it('is fixed at $0.25 to match the HyphaToken contract rate', () => {
    expect(HYPHA_PRICE_USD).toBe(0.25);
  });

  it('matches the HYPHA entry in the catalogue', () => {
    const hypha = TOKENS.find((token) => token.symbol === 'HYPHA');
    expect(hypha?.address).toBe(HYPHA_TOKEN_ADDRESS);
  });
});

describe('isHyphaToken', () => {
  it('matches the HYPHA address in any casing', () => {
    expect(isHyphaToken(HYPHA_TOKEN_ADDRESS)).toBe(true);
    expect(isHyphaToken(HYPHA_TOKEN_ADDRESS.toLowerCase())).toBe(true);
    expect(isHyphaToken(HYPHA_TOKEN_ADDRESS.toUpperCase())).toBe(true);
  });

  it('returns false for other or empty addresses', () => {
    expect(isHyphaToken('0x0000000000000000000000000000000000000001')).toBe(
      false,
    );
    expect(isHyphaToken(null)).toBe(false);
    expect(isHyphaToken(undefined)).toBe(false);
    expect(isHyphaToken('')).toBe(false);
  });
});

describe('EPARTS pricing', () => {
  it('values one participation at 1 EUR', () => {
    expect(EPARTS_PRICE_EUR).toBe(1);
    expect(EPARTS_REFERENCE_CURRENCY).toBe('EUR');
  });

  it('is not a catalogue token, so it needs the explicit override', () => {
    expect(isCatalogueToken(EPARTS_TOKEN_ADDRESS)).toBe(false);
  });
});

describe('isEpartsToken', () => {
  it('matches the EPARTS address in any casing', () => {
    expect(isEpartsToken(EPARTS_TOKEN_ADDRESS)).toBe(true);
    expect(isEpartsToken(EPARTS_TOKEN_ADDRESS.toLowerCase())).toBe(true);
    expect(isEpartsToken(EPARTS_TOKEN_ADDRESS.toUpperCase())).toBe(true);
  });

  it('returns false for other or empty addresses', () => {
    expect(isEpartsToken(HYPHA_TOKEN_ADDRESS)).toBe(false);
    expect(isEpartsToken(null)).toBe(false);
    expect(isEpartsToken(undefined)).toBe(false);
    expect(isEpartsToken('')).toBe(false);
  });
});
