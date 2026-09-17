import 'server-only';

import { AssetTransfersCategory, type AssetTransfersResult } from 'alchemy-sdk';
import { isAddress } from 'viem';

import { getAlchemy } from './alchemy-client';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const TRANSFER_PAGE_SIZE = 1000;
const MAX_TRANSFER_PAGES = 50;

export function collectHolderAddressesFromTransfers(
  transfers: ReadonlyArray<Pick<AssetTransfersResult, 'from' | 'to'>>,
): `0x${string}`[] {
  const holders = new Set<string>();
  for (const transfer of transfers) {
    if (transfer.from) holders.add(transfer.from.toLowerCase());
    if (transfer.to) holders.add(transfer.to.toLowerCase());
  }
  holders.delete(ZERO_ADDRESS);
  return Array.from(holders).filter((address): address is `0x${string}` =>
    isAddress(address),
  );
}

/**
 * Best-effort ERC-20 holder discovery via Alchemy transfer history.
 * Used to expand the unattributed "Other" bucket into per-wallet rows.
 */
export async function getErc20HolderAddresses(
  tokenAddress: `0x${string}`,
): Promise<`0x${string}`[]> {
  const alchemy = getAlchemy();
  const holders = new Set<`0x${string}`>();
  let pageKey: string | undefined;
  let pages = 0;

  do {
    const response = await alchemy.core.getAssetTransfers({
      fromBlock: '0x0',
      contractAddresses: [tokenAddress],
      category: [AssetTransfersCategory.ERC20],
      excludeZeroValue: true,
      maxCount: TRANSFER_PAGE_SIZE,
      pageKey,
    });
    for (const address of collectHolderAddressesFromTransfers(
      response.transfers,
    )) {
      holders.add(address);
    }
    pageKey = response.pageKey;
    pages += 1;
  } while (pageKey && pages < MAX_TRANSFER_PAGES);

  return Array.from(holders);
}
