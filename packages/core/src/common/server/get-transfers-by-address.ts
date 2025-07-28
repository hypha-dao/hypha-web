import 'server-only';
import { getAlchemy } from './alchemy-client';
import { AssetTransfersCategory } from 'alchemy-sdk';

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

export async function getTransfersByAddress(
  params: GetTransfersByAddressParams,
): Promise<Transfer[]> {
  const { address, contractAddresses, limit = 50 } = params;
  const alchemy = getAlchemy();

  const maxLimit = Math.min(limit, 50);

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

  const allTransfers = [...fromTransfers.transfers, ...toTransfers.transfers]
    .slice(0, maxLimit)
    .map((transfer) => {
      const blockNumber = parseInt(transfer.blockNum, 16);
      const getTimestampAndMetadata = async () => {
        const block = await alchemy.core.getBlock(blockNumber);
        const tokenMetadata = transfer.rawContract.address
          ? await alchemy.core.getTokenMetadata(transfer.rawContract.address)
          : { decimals: 18, symbol: transfer.asset || 'UNKNOWN' };
        return {
          timestamp: block.timestamp * 1000,
          decimals: tokenMetadata.decimals ?? 18,
          symbol: tokenMetadata.symbol ?? transfer.asset ?? 'UNKNOWN',
        };
      };

      return {
        from: transfer.from,
        to: transfer.to ?? '',
        value: transfer.value ? transfer.value.toString() : '0',
        symbol: transfer.asset ?? 'UNKNOWN',
        decimals: 18,
        token: transfer.rawContract.address ?? '',
        timestamp: 0,
        block_number: blockNumber,
        transaction_index: 0,
        transaction_hash: transfer.hash,
        _getTimestampAndMetadata: getTimestampAndMetadata,
      };
    });

  const transfersWithData = await Promise.all(
    allTransfers.map(async (transfer) => {
      const { timestamp, decimals, symbol } =
        await transfer._getTimestampAndMetadata();
      const value = transfer.value
        ? (
            parseFloat(transfer.value.toString()) * Math.pow(10, decimals)
          ).toString()
        : '0';
      const { _getTimestampAndMetadata, ...rest } = transfer;
      return { ...rest, timestamp, decimals, symbol, value };
    }),
  );

  transfersWithData.sort((a, b) => {
    return b.block_number - a.block_number;
  });

  return transfersWithData;
}
