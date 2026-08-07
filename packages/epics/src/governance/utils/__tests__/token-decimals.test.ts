import { describe, expect, it } from 'vitest';
import { resolveTokenDecimals } from '../token-decimals';

// Kept as a literal rather than imported from the core catalogue: pulling
// @hypha-platform/core/client into a unit test drags in storage-postgres,
// which refuses to load without a database connection string.
const AUDD_CHECKSUMMED = '0x449B3317a6d1efb1Bc3ba0700C9EaA4FFFf4Ae65';

describe('resolveTokenDecimals', () => {
  it('resolves the stablecoins at 6 and cbBTC at 8', () => {
    expect(
      resolveTokenDecimals('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
    ).toBe(6);
    expect(
      resolveTokenDecimals('0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42'),
    ).toBe(6);
    expect(
      resolveTokenDecimals('0x449b3317a6d1efb1bc3ba0700c9eaa4ffff4ae65'),
    ).toBe(6);
    expect(
      resolveTokenDecimals('0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf'),
    ).toBe(8);
  });

  // The catalogue stores EIP-55 checksummed addresses while this map is keyed
  // lowercase, so a token is only really covered if the checksummed form hits.
  it('resolves AUDD from its checksummed catalogue address', () => {
    expect(AUDD_CHECKSUMMED).not.toBe(AUDD_CHECKSUMMED.toLowerCase());
    expect(resolveTokenDecimals(AUDD_CHECKSUMMED)).toBe(6);
  });

  it('falls back to 18 for unmapped or missing addresses', () => {
    expect(
      resolveTokenDecimals('0x1111111111111111111111111111111111111111'),
    ).toBe(18);
    expect(resolveTokenDecimals(undefined)).toBe(18);
    expect(resolveTokenDecimals('')).toBe(18);
  });
});
