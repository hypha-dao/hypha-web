import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import {
  ERC20_TOKEN_TRANSFER_ADDRESSES,
  TOKENS,
  HYPHA_PRICE_USD,
  HYPHA_TOKEN_ADDRESS,
  isCatalogueToken,
  isHyphaToken,
  isKnownTreasuryToken,
  selectKnownHeldTokens,
} from '../tokens';
import {
  ASSET_PRICE_FEED_BY_TOKEN,
  getOraclePricedTokensHint,
} from '../token-backing-vault';

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

describe('TOKENS catalogue', () => {
  it('stores every address in EIP-55 checksummed form', () => {
    for (const token of TOKENS) {
      expect(getAddress(token.address)).toBe(token.address);
    }
  });

  it('has no duplicate addresses or symbols', () => {
    const addresses = TOKENS.map((t) => t.address.toLowerCase());
    // getTokenMeta matches symbols case-insensitively, so compare them that way.
    const symbols = TOKENS.map((t) => t.symbol.toUpperCase());
    expect(new Set(addresses).size).toBe(TOKENS.length);
    expect(new Set(symbols).size).toBe(TOKENS.length);
  });

  it('lists exactly the transferable tokens in ERC20_TOKEN_TRANSFER_ADDRESSES', () => {
    const transferable = TOKENS.filter((t) => t.transferable)
      .map((t) => t.address.toLowerCase())
      .sort();
    const allowlisted = ERC20_TOKEN_TRANSFER_ADDRESSES.map((a) =>
      a.toLowerCase(),
    ).sort();
    expect(allowlisted).toEqual(transferable);
  });

  // Decimals are asserted in packages/epics, where the resolver lives.
  it('carries AUDD on Base as a transferable token with an icon', () => {
    const audd = TOKENS.find((t) => t.symbol === 'AUDD');
    expect(audd?.address).toBe('0x449B3317a6d1efb1Bc3ba0700C9EaA4FFFf4Ae65');
    expect(audd?.transferable).toBe(true);
    expect(audd?.icon).toBe('/placeholder/audd-icon.svg');
    expect(
      ERC20_TOKEN_TRANSFER_ADDRESSES.map((a) => a.toLowerCase()),
    ).toContain(audd?.address.toLowerCase());
  });

  it('points every token at an icon asset', () => {
    for (const token of TOKENS) {
      expect(token.icon).toMatch(/^\/placeholder\/.+\.(svg|png)$/);
    }
  });
});

describe('getOraclePricedTokensHint', () => {
  it('lists every catalogue token that has a price feed', () => {
    // Parse the prose back into symbols so this matches whole entries; a
    // substring check would count USDC as listing a hypothetical USD.
    const listed = new Set(
      getOraclePricedTokensHint()
        .split(/,\s*or\s+|,\s*|\s+or\s+/)
        .filter(Boolean),
    );
    for (const token of TOKENS) {
      const hasFeed = Boolean(
        ASSET_PRICE_FEED_BY_TOKEN[token.address.toLowerCase()],
      );
      expect(listed.has(token.symbol)).toBe(hasFeed);
    }
  });

  it('reads as a prose list', () => {
    expect(getOraclePricedTokensHint()).toBe(
      'USDC, EURC, AUDD, WETH, or cbBTC',
    );
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

describe('selectKnownHeldTokens', () => {
  const dbToken = '0x2222222222222222222222222222222222222222';
  const spam = '0x1111111111111111111111111111111111111111';
  const known = new Set([dbToken.toLowerCase()]);

  it('keeps a positive-balance DB token issued by another space', () => {
    const selected = selectKnownHeldTokens(
      [
        {
          tokenAddress: dbToken,
          balance: 12.5,
          symbol: 'OTHR',
          name: 'Other Space Token',
        },
      ],
      known,
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.address).toBe(dbToken);
    expect(selected[0]?.symbol).toBe('OTHR');
  });

  it('keeps catalogue tokens even when they are not in knownAddresses', () => {
    const selected = selectKnownHeldTokens(
      [
        {
          tokenAddress: TOKENS[0].address,
          balance: 1,
          symbol: TOKENS[0].symbol,
        },
      ],
      new Set(),
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.address).toBe(TOKENS[0].address);
  });

  it('drops zero-balance, spam, and invalid addresses', () => {
    expect(
      selectKnownHeldTokens(
        [
          { tokenAddress: dbToken, balance: 0, symbol: 'OTHR' },
          { tokenAddress: spam, balance: 99, symbol: 'SPAM' },
          { tokenAddress: 'not-an-address', balance: 5, symbol: 'BAD' },
        ],
        known,
      ),
    ).toEqual([]);
  });

  it('dedupes the same held address', () => {
    const selected = selectKnownHeldTokens(
      [
        { tokenAddress: dbToken, balance: 1, symbol: 'OTHR' },
        { tokenAddress: dbToken.toUpperCase(), balance: 2, symbol: 'OTHR' },
      ],
      known,
    );
    expect(selected).toHaveLength(1);
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
