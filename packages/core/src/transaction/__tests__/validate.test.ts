import { describe, expect, it } from 'vitest';
import { resolveTransferTokenFilter } from '../validate';

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

describe('resolveTransferTokenFilter', () => {
  it('treats an omitted token query as unscoped', () => {
    expect(resolveTransferTokenFilter(null)).toBeUndefined();
  });

  it('keeps valid addresses', () => {
    expect(resolveTransferTokenFilter(USDC)).toEqual([USDC]);
    expect(resolveTransferTokenFilter(`${USDC}, 0xnot-an-address`)).toEqual([
      USDC,
    ]);
  });

  it('keeps an all-invalid token= so callers do not fall back to unscoped', () => {
    expect(resolveTransferTokenFilter('not-a-valid-address')).toEqual([
      'not-a-valid-address',
    ]);
    expect(resolveTransferTokenFilter('foo,bar')).toEqual(['foo', 'bar']);
  });

  it('uses a sentinel when token= is present but empty', () => {
    expect(resolveTransferTokenFilter('')).toEqual(['invalid']);
    expect(resolveTransferTokenFilter('   ,  ')).toEqual(['invalid']);
  });
});
