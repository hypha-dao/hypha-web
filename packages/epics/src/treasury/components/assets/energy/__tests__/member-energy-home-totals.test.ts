import { describe, expect, it } from 'vitest';

import { homeTotals } from '../member-energy-home-totals';
import type { SpaceEnergyResponse } from '../../../../hooks/use-space-energy';

const space = {
  enabled: true,
  overview: {
    memberCount: 2,
    sourceCount: 2,
    communityFeeBps: null,
    aggregatorFeeBps: null,
    gridBalance: null,
    settledBalance: null,
    contractStablecoinBalance: null,
    zeroSumOk: null,
    zeroSumDelta: null,
  },
  sources: [
    {
      sourceId: '0x1111111111111111111111111111111111111111',
      sourceType: 'SOLAR',
      sourceLabel: 'Roof',
      sourceDisplayName: 'Roof',
      ownershipToken: '0x2222222222222222222222222222222222222222',
      basePricePerKwh: '0',
      active: true,
    },
    {
      sourceId: '0x3333333333333333333333333333333333333333',
      sourceType: 'BATTERY',
      sourceLabel: 'Battery',
      sourceDisplayName: 'Battery',
      ownershipToken: '0x4444444444444444444444444444444444444444',
      basePricePerKwh: '0',
      active: true,
    },
  ],
  memberDetails: [
    {
      address: '0xAaaAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA',
      energyCreditBalance: null,
      debtInStablecoin: null,
      creditInStablecoin: null,
      ownerships: [
        {
          sourceId: '0x1111111111111111111111111111111111111111',
          sourceLabel: 'Roof',
          ownershipBps: 2500,
        },
        {
          sourceId: '0x3333333333333333333333333333333333333333',
          sourceLabel: 'Battery',
          ownershipBps: 1000,
        },
      ],
      deviceIds: [10],
    },
  ],
} as SpaceEnergyResponse;

const me = '0xAaaAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaA';
const other = '0xBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

describe('homeTotals', () => {
  it('scales production by the member ownership share', () => {
    const home = homeTotals(
      space,
      me,
      [{ values: [100, 200] }, { values: [40, 60] }],
      [{ meterId: 10, valuesKwh: [20, 30] }],
    );

    expect(home.makeIsHome).toBe(true);
    expect(home.useIsHome).toBe(true);
    expect(home.paired).toBe(true);
    // 25% of solar + 10% of battery
    expect(home.make).toEqual([29, 56]);
    expect(home.use).toEqual([20, 30]);
  });

  it('does not fall back to community totals without a member match', () => {
    const home = homeTotals(
      space,
      other,
      [{ values: [100, 200] }, { values: [40, 60] }],
      [{ meterId: 10, valuesKwh: [20, 30] }],
    );

    expect(home.makeIsHome).toBe(false);
    expect(home.useIsHome).toBe(false);
    expect(home.make).toEqual([0, 0]);
    expect(home.use).toEqual([0, 0]);
  });

  it('still computes ownership when meter readings are missing', () => {
    const home = homeTotals(
      space,
      me,
      [{ values: [80] }, { values: [20] }],
      [],
    );

    expect(home.makeIsHome).toBe(true);
    expect(home.useIsHome).toBe(false);
    expect(home.make).toEqual([22]);
    expect(home.use).toEqual([0]);
  });
});
