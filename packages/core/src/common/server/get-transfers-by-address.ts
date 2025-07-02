import { getMoralis } from './moralis-client';

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
  /**
   * Note: string because it can be bigger than builtin number
   */
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
  const moralis = await getMoralis();
  const response = await moralis.EvmApi.token.getWalletTokenTransfers(params);

  return response.toJSON().result.map((trx) => {
    return {
      from: trx.from_address,
      to: trx.to_address,
      value: trx.value,
      symbol: trx.token_symbol,
      decimals: +trx.token_decimals,
      token: trx.address,
      timestamp: Date.parse(trx.block_timestamp),
      block_number: +trx.block_number,
      transaction_index: trx.transaction_index,
      transaction_hash: trx.transaction_hash,
    } as Transfer;
  });
}
