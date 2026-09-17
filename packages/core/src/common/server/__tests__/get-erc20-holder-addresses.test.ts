import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { collectHolderAddressesFromTransfers } from '../get-erc20-holder-addresses';

describe('collectHolderAddressesFromTransfers', () => {
  it('collects unique from/to addresses and drops the zero address', () => {
    const holders = collectHolderAddressesFromTransfers([
      {
        from: '0x0000000000000000000000000000000000000000',
        to: '0x1111111111111111111111111111111111111111',
      },
      {
        from: '0x1111111111111111111111111111111111111111',
        to: '0x2222222222222222222222222222222222222222',
      },
      {
        from: '0x2222222222222222222222222222222222222222',
        to: '0x0000000000000000000000000000000000000000',
      },
    ]);

    expect(holders.sort()).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
    ]);
  });
});
