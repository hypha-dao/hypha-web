import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';

import {
  applyTokenAddressFilter,
  buildTokenHoldingsSearchParams,
  parseTokenAddressQuery,
  TOKEN_HOLDINGS_EXPORT_QUERY,
} from '../token-holdings-query';

function withBrokenChecksum(address: `0x${string}`): string {
  for (let index = 2; index < address.length; index += 1) {
    const char = address[index];
    if (char === undefined) continue;
    if (char >= 'a' && char <= 'f') {
      return `${address.slice(0, index)}${char.toUpperCase()}${address.slice(
        index + 1,
      )}`;
    }
    if (char >= 'A' && char <= 'F') {
      return `${address.slice(0, index)}${char.toLowerCase()}${address.slice(
        index + 1,
      )}`;
    }
  }
  throw new Error('address has no hex letters to flip');
}

describe('parseTokenAddressQuery', () => {
  it('treats missing and blank values as none', () => {
    expect(parseTokenAddressQuery(undefined)).toEqual({ status: 'none' });
    expect(parseTokenAddressQuery(null)).toEqual({ status: 'none' });
    expect(parseTokenAddressQuery('')).toEqual({ status: 'none' });
    expect(parseTokenAddressQuery('   ')).toEqual({ status: 'none' });
  });

  it('accepts a checksummed address and lowercases it', () => {
    const lowercase = '0x8b93862835c36e9689e9bb1ab21de3982e266cd3';
    expect(parseTokenAddressQuery(lowercase)).toEqual({
      status: 'ok',
      address: lowercase,
    });
    expect(parseTokenAddressQuery(getAddress(lowercase))).toEqual({
      status: 'ok',
      address: lowercase,
    });
  });

  it('rejects malformed addresses', () => {
    expect(parseTokenAddressQuery('not-an-address')).toEqual({
      status: 'invalid',
    });
    expect(parseTokenAddressQuery('0x1234')).toEqual({ status: 'invalid' });
    expect(
      parseTokenAddressQuery('0x8b93862835c36e9689e9bb1ab21de3982e266cd3ff'),
    ).toEqual({ status: 'invalid' });
    expect(
      parseTokenAddressQuery('0xZZ93862835c36e9689e9bb1ab21de3982e266cd3'),
    ).toEqual({ status: 'invalid' });
  });

  it('rejects a wrong mixed-case checksum and accepts a valid address', () => {
    const lowercase = '0x8b93862835c36e9689e9bb1ab21de3982e266cd3';
    const checksummed = getAddress(lowercase);
    expect(parseTokenAddressQuery(withBrokenChecksum(checksummed))).toEqual({
      status: 'invalid',
    });
    expect(parseTokenAddressQuery(checksummed)).toEqual({
      status: 'ok',
      address: lowercase,
    });
    expect(parseTokenAddressQuery(lowercase)).toEqual({
      status: 'ok',
      address: lowercase,
    });
  });
});

describe('applyTokenAddressFilter', () => {
  const tokens = [
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  ] as const;

  it('returns all addresses when no filter is set', () => {
    expect(applyTokenAddressFilter(tokens)).toEqual([...tokens]);
    expect(applyTokenAddressFilter(tokens, '')).toEqual([...tokens]);
  });

  it('keeps only the matching address, case-insensitively', () => {
    expect(
      applyTokenAddressFilter(
        tokens,
        '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
      ),
    ).toEqual(['0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']);
  });

  it('returns an empty list when the token is not in the space set', () => {
    expect(
      applyTokenAddressFilter(
        tokens,
        '0xcccccccccccccccccccccccccccccccccccccccc',
      ),
    ).toEqual([]);
  });
});

describe('buildTokenHoldingsSearchParams', () => {
  it('includes the token_address filter for a single-token export', () => {
    const params = buildTokenHoldingsSearchParams({
      ...TOKEN_HOLDINGS_EXPORT_QUERY,
      tokenAddress: '0x8b93862835c36e9689e9bb1ab21de3982e266cd3',
    });

    expect(params.get('include_treasury')).toBe('true');
    expect(params.get('collapse_below_pct')).toBe('0');
    expect(params.get('expand_unknown_holders')).toBe('true');
    expect(params.get('token_address')).toBe(
      '0x8b93862835c36e9689e9bb1ab21de3982e266cd3',
    );
    expect(params.get('holder_limit')).toBeNull();
  });

  it('omits token_address when unset so the full-space export stays unchanged', () => {
    const params = buildTokenHoldingsSearchParams(TOKEN_HOLDINGS_EXPORT_QUERY);
    expect(params.get('token_address')).toBeNull();
  });
});
