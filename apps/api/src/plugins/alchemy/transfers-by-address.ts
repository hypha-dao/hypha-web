import {
  type Alchemy,
  type AssetTransfersWithMetadataResult,
  AssetTransfersCategory,
} from 'alchemy-sdk';

export interface GetAssetTransfersParams {
  address: `0x${string}`;
  contracts?: `0x${string}`[];
  limit?: number;
}

export function newGetAssetTransfers(client: Alchemy) {
  /**
   * @param address Filter transfers where address is from or to
   * @param contracts Filter only specific contracts
   * @param limit Defaults to 20
   */
  return async function getAssetTransfers({
    address,
    contracts,
    limit = 20,
  }: GetAssetTransfersParams) {
    const [from, to] = await Promise.all([
      client.core.getAssetTransfers({
        fromAddress: address,
        category: [AssetTransfersCategory.ERC20],
        contractAddresses: contracts,
        withMetadata: true,
        maxCount: limit * 2,
      }),
      client.core.getAssetTransfers({
        toAddress: address,
        category: [AssetTransfersCategory.ERC20],
        contractAddresses: contracts,
        withMetadata: true,
        maxCount: limit * 2,
      }),
    ]);
    const fromTransfers = from.transfers.map(newMapperToTransfer('payment'));
    const toTransfers = to.transfers.map(newMapperToTransfer('income'));

    return fromTransfers
      .concat(toTransfers)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  };
}

function newMapperToTransfer(direction: 'income' | 'payment') {
  return (transfer: AssetTransfersWithMetadataResult) => {
    return {
      raw: transfer,
      from: transfer.from,
      to: transfer.to,
      symbol: transfer.asset,
      amount: transfer.value,
      timestamp: new Date(transfer.metadata.blockTimestamp),
      direction,
    };
  };
}
