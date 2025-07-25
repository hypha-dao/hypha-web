import 'server-only';
import { getMoralis } from './moralis-client';

export async function getWalletTokenBalancesPriceByAddress(
  address: `0x${string}`,
  chainId = '0x2105',
) {
  const moralis = await getMoralis();

  const { result } = await moralis.EvmApi.wallets.getWalletTokenBalancesPrice({
    chain: chainId,
    address: address,
  });

  return result;
}
