import { describe, it, expect } from 'vitest';
import {
  buildUpdateTokenInputPatchFromTokenUpdateData,
  omitUndefinedValues,
} from '../token-update-apply';
import type { TokenUpdateData } from '../../types';

describe('buildUpdateTokenInputPatchFromTokenUpdateData', () => {
  it('includes only own keys from mutable allowlist', () => {
    const data = {
      name: 'New',
      symbol: 'SYM',
    } as TokenUpdateData;
    const patch = buildUpdateTokenInputPatchFromTokenUpdateData(data);
    expect(patch).toEqual({ name: 'New', symbol: 'SYM' });
  });

  it('does not apply type or isVotingToken from JSON even when present', () => {
    const data = {
      name: 'X',
      type: 'utility',
      isVotingToken: true,
    } as TokenUpdateData;
    const patch = buildUpdateTokenInputPatchFromTokenUpdateData(data);
    expect(patch).toEqual({ name: 'X' });
    expect(patch).not.toHaveProperty('type');
    expect(patch).not.toHaveProperty('isVotingToken');
  });

  it('includes iconUrl only when key is present', () => {
    const withIcon = {
      name: 'A',
      iconUrl: 'https://x/y.png',
    } as TokenUpdateData;
    expect(
      buildUpdateTokenInputPatchFromTokenUpdateData(withIcon),
    ).toMatchObject({
      name: 'A',
      iconUrl: 'https://x/y.png',
    });

    const noIcon = { name: 'B' } as TokenUpdateData;
    expect(
      buildUpdateTokenInputPatchFromTokenUpdateData(noIcon),
    ).not.toHaveProperty('iconUrl');
  });

  it('does not inherit prototype keys', () => {
    const data = Object.create({ name: 'proto' });
    data.symbol = 'S';
    const patch = buildUpdateTokenInputPatchFromTokenUpdateData(
      data as TokenUpdateData,
    );
    expect(patch).toEqual({ symbol: 'S' });
  });
});

describe('omitUndefinedValues', () => {
  it('removes undefined entries', () => {
    expect(
      omitUndefinedValues({
        a: 1,
        b: undefined,
        c: 'x',
      }),
    ).toEqual({ a: 1, c: 'x' });
  });
});
