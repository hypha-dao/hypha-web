import 'server-only';
import { getAlchemy } from './alchemy-client';
import { TokenBalanceType } from 'alchemy-sdk';
import { isAddress } from 'ethers';

export async function getTokenBalancesByAddress(address: `0x${string}`) {
  if (!isAddress(address)) {
    throw new Error('Invalid Ethereum address format');
  }
  const alchemy = getAlchemy();

  const balances = await alchemy.core.getTokenBalances(address, {
    type: TokenBalanceType.ERC20,
  });

  const tokensWithMetadata = await Promise.all(
    balances.tokenBalances.map(async (balance) => {
      try {
        const metadata = await alchemy.core.getTokenMetadata(
          balance.contractAddress,
        );
        return {
          tokenAddress: balance.contractAddress,
          balance:
            parseInt(balance.tokenBalance || '0', 16) /
            10 ** (metadata.decimals || 18), // Convert from wei
          symbol: metadata.symbol || 'UNKNOWN',
          name: metadata.name || 'Unnamed',
          logo: metadata.logo || '/placeholder/token-icon.png',
        };
      } catch (error) {
        console.warn(
          `Failed to fetch metadata for token ${balance.contractAddress}:`,
          error,
        );
        return null;
      }
    }),
  );

  return tokensWithMetadata.filter((token) => token !== null);
}
