import { describe, expect, it } from 'vitest';

import {
  mapSpaceTreasuryAssets,
  spaceTreasuryDistributionShare,
} from '../space-treasury-assets';

describe('mapSpaceTreasuryAssets', () => {
  it('keeps zero-balance tokens so the treasury panel can render', () => {
    expect(
      mapSpaceTreasuryAssets([
        {
          symbol: 'HUMAILLL',
          value: 0,
          usdEqual: 0,
          address: '0xabc',
        },
        { symbol: '  ', value: 1 },
        { value: 5 },
      ]),
    ).toEqual([
      {
        symbol: 'HUMAILLL',
        value: 0,
        usdEqual: 0,
        address: '0xabc',
      },
    ]);
  });
});

describe('spaceTreasuryDistributionShare', () => {
  it('splits evenly when every balance is zero', () => {
    expect(spaceTreasuryDistributionShare(0, 0, 2)).toBe(0.5);
  });

  it('uses balance share when the total is positive', () => {
    expect(spaceTreasuryDistributionShare(25, 100, 2)).toBe(0.25);
  });
});
