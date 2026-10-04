import { describe, expect, it } from 'vitest';

import {
  applyTokenAddressFilter,
  buildTokenHoldingsSearchParams,
  parseTokenAddressQuery,
  TOKEN_HOLDINGS_EXPORT_QUERY,
} from '../token-holdings-query';

describe('parseTokenAddressQuery', () => {
  it('treats missing and blank values as none', () => {
    expect(parseTokenAddressQuery(undefined)).toEqual({ status: 'none' });
    expect(parseTokenAddressQuery(null)).toEqual({ status: 'none' });
    expect(parseTokenAddressQuery('')).toEqual({ status: 'none' });
    expect(parseTokenAddressQuery('   ')).toEqual({ status: 'none' });
  });

  it('accepts a checksummed address and lowercases it', () => {
    expect(
      parseTokenAddressQuery('0x8b93862835c36e9689e9bb1ab21de3982e266cd3'),
    ).toEqual({
      status: 'ok',
      address: '0x8b93862835c36e9689e9bb1ab21de3982e266cd3',
    });
    expect(
      parseTokenAddressQuery('0x8B93862835C36E9689E9BB1AB21DE3982E266CD3'),
    ).toEqual({
      status: 'ok',
      address: '0x8b93862835c36e9689e9bb1ab21de3982e266cd3',
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
