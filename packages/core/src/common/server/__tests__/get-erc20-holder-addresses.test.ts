import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const getAssetTransfers = vi.fn();

vi.mock('../alchemy-client', () => ({
  getAlchemy: () => ({
    core: { getAssetTransfers },
  }),
}));

import {
  collectHolderAddressesFromTransfers,
  getErc20HolderAddresses,
} from '../get-erc20-holder-addresses';

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

describe('getErc20HolderAddresses', () => {
  const token = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

  beforeEach(() => {
    getAssetTransfers.mockReset();
  });

  it('marks discovery complete when Alchemy has no further pages', async () => {
    getAssetTransfers.mockResolvedValueOnce({
      transfers: [
        {
          from: '0x1111111111111111111111111111111111111111',
          to: '0x2222222222222222222222222222222222222222',
        },
      ],
    });

    await expect(getErc20HolderAddresses(token)).resolves.toEqual({
      addresses: [
        '0x1111111111111111111111111111111111111111',
        '0x2222222222222222222222222222222222222222',
      ],
      complete: true,
    });
  });

  it('marks discovery incomplete when pagination is truncated', async () => {
    getAssetTransfers
      .mockResolvedValueOnce({
        transfers: [
          {
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
          },
        ],
        pageKey: 'page-2',
      })
      .mockResolvedValueOnce({
        transfers: [
          {
            from: '0x3333333333333333333333333333333333333333',
            to: '0x1111111111111111111111111111111111111111',
          },
        ],
        pageKey: 'page-3',
      });

    const result = await getErc20HolderAddresses(token, { maxPages: 2 });

    expect(result.complete).toBe(false);
    expect(result.addresses.sort()).toEqual([
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333',
    ]);
    expect(getAssetTransfers).toHaveBeenCalledTimes(2);
  });
});
