import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SortingOrder } from 'alchemy-sdk';
import { getAddress } from 'viem';
import { TOKENS } from '../../web3/tokens';

vi.mock('server-only', () => ({}));

const getAssetTransfers = vi.fn();
const getTokenMetadata = vi.fn();

vi.mock('../alchemy-client', () => ({
  getAlchemy: () => ({
    core: { getAssetTransfers, getTokenMetadata },
  }),
}));

import { getTransfersByAddress } from '../get-transfers-by-address';

const WALLET = '0x1111111111111111111111111111111111111111';
const COUNTERPARTY = '0x2222222222222222222222222222222222222222';
const DB_TOKEN = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const SPAM_A = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const SPAM_B = '0xcccccccccccccccccccccccccccccccccccccccc';
const USDC = TOKENS.find((token) => token.symbol === 'USDC')?.address ?? '';

function rawTransfer({
  token,
  blockNum,
  hash,
  timestamp = '2026-01-02T00:00:00.000Z',
  asset = 'TKN',
}: {
  token: string;
  blockNum: string;
  hash: string;
  timestamp?: string;
  asset?: string;
}) {
  return {
    from: COUNTERPARTY,
    to: WALLET,
    hash,
    blockNum,
    value: 1,
    asset,
    rawContract: { address: token },
    metadata: { blockTimestamp: timestamp },
  };
}

describe('getTransfersByAddress', () => {
  beforeEach(() => {
    getAssetTransfers.mockReset();
    getTokenMetadata.mockReset();
    getTokenMetadata.mockResolvedValue({ symbol: 'OK', decimals: 18 });
  });

  it('returns allowlisted transfers newest-first and skips spam metadata', async () => {
    const knownAddresses = new Set([DB_TOKEN]);

    getAssetTransfers.mockImplementation(
      async (params: { fromAddress?: string }) => {
        if (params.fromAddress) {
          return { transfers: [] };
        }
        return {
          transfers: [
            rawTransfer({
              token: SPAM_A,
              blockNum: '0x64',
              hash: '0xspam-new',
              asset: 'SPAM',
            }),
            rawTransfer({
              token: USDC,
              blockNum: '0x32',
              hash: '0xusdc',
              asset: 'USDC',
            }),
            rawTransfer({
              token: SPAM_B,
              blockNum: '0x28',
              hash: '0xspam-old',
              asset: 'JUNK',
            }),
            rawTransfer({
              token: DB_TOKEN,
              blockNum: '0x14',
              hash: '0xdb',
              asset: 'SPACE',
            }),
          ],
        };
      },
    );

    const transfers = await getTransfersByAddress({
      address: WALLET,
      knownAddresses,
      limit: 50,
    });

    expect(transfers.map((transfer) => transfer.transaction_hash)).toEqual([
      '0xusdc',
      '0xdb',
    ]);
    expect(transfers[0]?.block_number).toBeGreaterThan(
      transfers[1]?.block_number ?? 0,
    );
    expect(
      getTokenMetadata.mock.calls.map((call) => call[0].toLowerCase()),
    ).toEqual([USDC.toLowerCase(), DB_TOKEN]);
    expect(getTokenMetadata).not.toHaveBeenCalledWith(SPAM_A);
    expect(getTokenMetadata).not.toHaveBeenCalledWith(SPAM_B);
    for (const [params] of getAssetTransfers.mock.calls) {
      expect(params.contractAddresses).toBeUndefined();
      expect(params).not.toHaveProperty('pageKey');
    }
  });

  it('forwards an explicit token filter and omits it when only an allowlist is set', async () => {
    getAssetTransfers.mockResolvedValue({ transfers: [] });

    await getTransfersByAddress({
      address: WALLET,
      contractAddresses: [DB_TOKEN, 'not-an-address'],
      knownAddresses: new Set([DB_TOKEN]),
    });

    expect(getAssetTransfers).toHaveBeenCalled();
    for (const [params] of getAssetTransfers.mock.calls) {
      expect(params.contractAddresses).toEqual([getAddress(DB_TOKEN)]);
    }
  });

  it('keeps the other direction when one Alchemy call returns 400', async () => {
    const knownAddresses = new Set([DB_TOKEN]);

    getAssetTransfers.mockImplementation(
      async (params: { fromAddress?: string }) => {
        if (params.fromAddress) {
          const error = new Error('Invalid contractAddresses');
          (error as Error & { status: number }).status = 400;
          throw error;
        }
        return {
          transfers: [
            rawTransfer({
              token: DB_TOKEN,
              blockNum: '0x10',
              hash: '0xinbound',
              asset: 'SPACE',
            }),
          ],
        };
      },
    );

    const transfers = await getTransfersByAddress({
      address: WALLET,
      knownAddresses,
    });

    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.transaction_hash).toBe('0xinbound');
  });

  it('pages newest-first until enough allowlisted rows exist', async () => {
    const knownAddresses = new Set([DB_TOKEN]);

    getAssetTransfers.mockImplementation(
      async (params: { fromAddress?: string; pageKey?: string }) => {
        if (params.fromAddress) {
          return { transfers: [] };
        }
        if (!params.pageKey) {
          return {
            transfers: [
              rawTransfer({
                token: SPAM_A,
                blockNum: '0x3e8',
                hash: '0xspam-1',
              }),
              rawTransfer({
                token: SPAM_B,
                blockNum: '0x3e7',
                hash: '0xspam-2',
              }),
            ],
            pageKey: 'page-2',
          };
        }
        return {
          transfers: [
            rawTransfer({
              token: DB_TOKEN,
              blockNum: '0x10',
              hash: '0xallowlisted',
              asset: 'SPACE',
            }),
          ],
        };
      },
    );

    const transfers = await getTransfersByAddress({
      address: WALLET,
      knownAddresses,
      limit: 1,
    });

    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.transaction_hash).toBe('0xallowlisted');
    expect(transfers[0]?.token.toLowerCase()).toBe(DB_TOKEN);
    expect(
      getAssetTransfers.mock.calls.some(
        (call) => call[0]?.pageKey === 'page-2',
      ),
    ).toBe(true);
  });

  it('keeps other transfers when getTokenMetadata throws', async () => {
    const knownAddresses = new Set([DB_TOKEN]);

    getAssetTransfers.mockImplementation(
      async (params: { fromAddress?: string }) => {
        if (params.fromAddress) {
          return { transfers: [] };
        }
        return {
          transfers: [
            rawTransfer({
              token: USDC,
              blockNum: '0x20',
              hash: '0xusdc',
              asset: 'USDC',
            }),
            rawTransfer({
              token: DB_TOKEN,
              blockNum: '0x10',
              hash: '0xdb',
              asset: 'SPACE',
            }),
          ],
        };
      },
    );
    getTokenMetadata.mockImplementation(async (address: string) => {
      if (address.toLowerCase() === USDC.toLowerCase()) {
        throw new Error('429 Too Many Requests');
      }
      return { symbol: 'SPACE', decimals: 18 };
    });

    const transfers = await getTransfersByAddress({
      address: WALLET,
      knownAddresses,
    });

    expect(transfers).toHaveLength(2);
    expect(transfers[0]?.symbol).toBe('USDC');
    expect(transfers[1]?.symbol).toBe('SPACE');
  });

  it('pages until enough allowlisted rows fall inside the date window', async () => {
    const knownAddresses = new Set([DB_TOKEN]);
    const fromDate = new Date('2026-01-01T00:00:00.000Z');
    const toDate = new Date('2026-01-31T23:59:59.000Z');

    getAssetTransfers.mockImplementation(
      async (params: { fromAddress?: string; pageKey?: string }) => {
        if (params.fromAddress) {
          return { transfers: [] };
        }
        if (!params.pageKey) {
          return {
            transfers: [
              rawTransfer({
                token: DB_TOKEN,
                blockNum: '0x64',
                hash: '0xout-of-window',
                timestamp: '2026-02-15T00:00:00.000Z',
                asset: 'SPACE',
              }),
            ],
            pageKey: 'page-2',
          };
        }
        return {
          transfers: [
            rawTransfer({
              token: DB_TOKEN,
              blockNum: '0x10',
              hash: '0xin-window',
              timestamp: '2026-01-15T00:00:00.000Z',
              asset: 'SPACE',
            }),
          ],
        };
      },
    );

    const transfers = await getTransfersByAddress({
      address: WALLET,
      knownAddresses,
      fromDate,
      toDate,
      limit: 1,
    });

    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.transaction_hash).toBe('0xin-window');
    expect(
      getAssetTransfers.mock.calls.some(
        (call) => call[0]?.pageKey === 'page-2',
      ),
    ).toBe(true);
  });

  it('returns no transfers when every token= address is invalid', async () => {
    await expect(
      getTransfersByAddress({
        address: WALLET,
        contractAddresses: ['not-an-address', '0xdead'],
      }),
    ).resolves.toEqual([]);
    expect(getAssetTransfers).not.toHaveBeenCalled();
  });

  it('throws when one direction fails and the other returns no rows', async () => {
    getAssetTransfers.mockImplementation(
      async (params: { fromAddress?: string }) => {
        if (params.fromAddress) {
          const error = new Error('Invalid contractAddresses');
          (error as Error & { status: number }).status = 400;
          throw error;
        }
        return { transfers: [] };
      },
    );

    await expect(getTransfersByAddress({ address: WALLET })).rejects.toThrow(
      'Alchemy getAssetTransfers failed',
    );
  });

  it('sends DESCENDING order, hex block bounds, and maxCount to Alchemy', async () => {
    getAssetTransfers.mockResolvedValue({ transfers: [] });

    await getTransfersByAddress({
      address: WALLET,
      fromBlock: 1000,
      toBlock: 2000,
      limit: 50,
    });

    expect(getAssetTransfers).toHaveBeenCalled();
    for (const [params] of getAssetTransfers.mock.calls) {
      expect(params.order).toBe(SortingOrder.DESCENDING);
      expect(params.maxCount).toBe(1000);
      expect(params.fromBlock).toBe('0x3e8');
      expect(params.toBlock).toBe('0x7d0');
      expect(params.withMetadata).toBe(true);
      expect(params).not.toHaveProperty('pageKey');
      expect(params).not.toHaveProperty('contractAddresses');
    }
  });
});
