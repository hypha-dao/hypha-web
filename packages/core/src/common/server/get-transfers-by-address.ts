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

  let fromTransfers;
  let toTransfers;

  try {
    const fromTransfersPromise = alchemy.core.getAssetTransfers({
      fromAddress: address,
      category: [AssetTransfersCategory.ERC20],
      contractAddresses,
      withMetadata: true,
    });
    const fromTimeoutPromise = new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('fromTransfers request timeout')),
        10000,
      ),
    );
    fromTransfers = (await Promise.race([
      fromTransfersPromise,
      fromTimeoutPromise,
    ])) as Awaited<ReturnType<typeof alchemy.core.getAssetTransfers>>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[getTransfersByAddress] Failed to fetch fromTransfers for ${address}: ${errorMessage}`,
    );
    // Continue with empty transfers if one direction fails
    fromTransfers = { transfers: [] };
  }

  try {
    const toTransfersPromise = alchemy.core.getAssetTransfers({
      toAddress: address,
      category: [AssetTransfersCategory.ERC20],
      contractAddresses,
      withMetadata: true,
    });
    const toTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('toTransfers request timeout')), 10000),
    );
    toTransfers = (await Promise.race([
      toTransfersPromise,
      toTimeoutPromise,
    ])) as Awaited<ReturnType<typeof alchemy.core.getAssetTransfers>>;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `[getTransfersByAddress] Failed to fetch toTransfers for ${address}: ${errorMessage}`,
    );
    // Continue with empty transfers if one direction fails
    toTransfers = { transfers: [] };
  }

  const allTransfers = [
    ...fromTransfers.transfers,
    ...toTransfers.transfers,
  ].map((transfer) => {
    const blockNumber = parseInt(transfer.blockNum, 16);
    // Safe access to metadata with type assertion
    const transferWithMetadata = transfer as unknown as {
      metadata?: { blockTimestamp?: string };
    };
    const timestamp = transferWithMetadata.metadata?.blockTimestamp
      ? Date.parse(transferWithMetadata.metadata.blockTimestamp) || 0
      : 0;

    const getMetadata = async () => {
      if (!transfer.rawContract.address) {
        return {
          decimals: 18,
          symbol: transfer.asset || 'UNKNOWN',
        };
      }

      try {
        // Add timeout for token metadata requests to prevent hanging
        const tokenMetadataPromise = alchemy.core.getTokenMetadata(
          transfer.rawContract.address,
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Token metadata request timeout')),
            5000,
          ),
        );

        const tokenMetadata = (await Promise.race([
          tokenMetadataPromise,
          timeoutPromise,
        ])) as Awaited<ReturnType<typeof alchemy.core.getTokenMetadata>>;

        return {
          decimals: tokenMetadata.decimals ?? 18,
          symbol: tokenMetadata.symbol ?? transfer.asset ?? 'UNKNOWN',
        };
      } catch (error) {
        // Log but don't fail - use fallback values
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[getTransfersByAddress] Failed to fetch token metadata for ${transfer.rawContract.address}: ${errorMessage}`,
        );
        // Fallback to default values if metadata fetch fails
        return {
          decimals: 18,
          symbol: transfer.asset || 'UNKNOWN',
        };
      }
    };

    return {
      from: transfer.from,
      to: transfer.to ?? '',
      value: transfer.value ? transfer.value.toString() : '0',
      symbol: transfer.asset ?? 'UNKNOWN',
      decimals: 18,
      token: transfer.rawContract.address ?? '',
      timestamp,
      block_number: blockNumber,
      transaction_index: 0,
      transaction_hash: transfer.hash,
      _getMetadata: getMetadata,
    };
  });

  const transfersWithData = await Promise.allSettled(
    allTransfers.map(async (transfer) => {
      try {
        const { decimals, symbol } = await transfer._getMetadata();
        const { _getMetadata, ...rest } = transfer;
        return { ...rest, decimals, symbol };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.warn(
          `[getTransfersByAddress] Failed to process transfer ${transfer.transaction_hash}: ${errorMessage}`,
        );
        // Return transfer with default metadata if processing fails
        const { _getMetadata, ...rest } = transfer;
        return { ...rest, decimals: 18, symbol: transfer.symbol || 'UNKNOWN' };
      }
    }),
  );

  const successfulTransfers = transfersWithData
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter((t) => t !== null) as Transfer[];

  successfulTransfers.sort((a, b) => {
    return b.block_number - a.block_number;
  });

  return successfulTransfers;
}
