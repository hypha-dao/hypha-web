import 'server-only';
import { getAlchemy } from './alchemy-client';
import {
  type Alchemy,
  type AssetTransfersWithMetadataResult,
  AssetTransfersCategory,
} from 'alchemy-sdk';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export type GetTransfersByAddressParams = {
  address: string;
  contractAddresses?: string[];
  fromDate?: Date;
  toDate?: Date;
  fromBlock?: number;
  toBlock?: number;
  limit?: number;
};

export type Transfer = {
  from: string;
  to: string;
  value: string;
  symbol: string;
  decimals: number;
  token: string;
  timestamp: number;
  block_number: number;
  transaction_index: number;
  transaction_hash: string;
};

async function toTransfersWithMetadata(
  alchemy: Alchemy,
  rawTransfers: AssetTransfersWithMetadataResult[],
): Promise<Transfer[]> {
  // Cache metadata per unique token contract so multiple transfers sharing the
  // same token trigger at most one external `getTokenMetadata` call.
  const metadataCache = new Map<
    string,
    { decimals: number | null; symbol: string | null }
  >();

  const getMetadata = async (
    address: string | null,
    fallbackAsset: string | null,
  ) => {
    if (!address) {
      return { decimals: 18, symbol: fallbackAsset || 'UNKNOWN' };
    }
    const key = address.toLowerCase();
    const cached = metadataCache.get(key);
    if (cached) {
      return cached;
    }
    const metadata = await alchemy.core.getTokenMetadata(address);
    metadataCache.set(key, metadata);
    return metadata;
  };

  const transfersWithData = await Promise.all(
    rawTransfers.map(async (transfer) => {
      const blockNumber = parseInt(transfer.blockNum, 16);
      const timestamp = Date.parse(transfer.metadata.blockTimestamp) || 0;

      const tokenMetadata = await getMetadata(
        transfer.rawContract.address,
        transfer.asset,
      );

      return {
        from: transfer.from,
        to: transfer.to ?? '',
        value: transfer.value ? transfer.value.toString() : '0',
        symbol: tokenMetadata.symbol ?? transfer.asset ?? 'UNKNOWN',
        decimals: tokenMetadata.decimals ?? 18,
        token: transfer.rawContract.address ?? '',
        timestamp,
        block_number: blockNumber,
        transaction_index: 0,
        transaction_hash: transfer.hash,
      };
    }),
  );

  transfersWithData.sort((a, b) => {
    return b.block_number - a.block_number;
  });

  return transfersWithData;
}

export async function getTransfersByAddress(
  params: GetTransfersByAddressParams,
): Promise<Transfer[]> {
  const { address, contractAddresses } = params;
  const alchemy = getAlchemy();

  const fromTransfers = await alchemy.core.getAssetTransfers({
    fromAddress: address,
    category: [AssetTransfersCategory.ERC20],
    contractAddresses,
    withMetadata: true,
  });

  const toTransfers = await alchemy.core.getAssetTransfers({
    toAddress: address,
    category: [AssetTransfersCategory.ERC20],
    contractAddresses,
    withMetadata: true,
  });

  return toTransfersWithMetadata(alchemy, [
    ...fromTransfers.transfers,
    ...toTransfers.transfers,
  ]);
}

/**
 * Returns mint events (ERC-20 `Transfer` from the zero address) for the given
 * token contracts, regardless of recipient.
 *
 * Mints don't reference the minting space anywhere in the Transfer event, so
 * address-based queries can't find them; querying by the space's own token
 * contracts is the way to surface tokens a space minted to other accounts
 * (e.g. airdrops to members).
 */
export async function getMintTransfersByTokens({
  contractAddresses,
}: {
  contractAddresses: string[];
}): Promise<Transfer[]> {
  if (contractAddresses.length === 0) {
    return [];
  }
  const alchemy = getAlchemy();

  const mints = await alchemy.core.getAssetTransfers({
    fromAddress: ZERO_ADDRESS,
    category: [AssetTransfersCategory.ERC20],
    contractAddresses,
    withMetadata: true,
  });

  return toTransfersWithMetadata(alchemy, mints.transfers);
}
