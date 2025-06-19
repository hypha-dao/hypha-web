import { publicClient, TOKENS, Token } from '@core/common/web3';
import { erc20Abi, getContract } from 'viem';

export async function getTokenMeta(
  tokenAddress: `0x${string}`,
): Promise<Omit<Token, 'address'>> {
  const stable = TOKENS.find((token) => token.address == tokenAddress);
  if (stable) {
    return stable;
  }

  const contract = getContract({
    address: tokenAddress,
    abi: erc20Abi,
    client: publicClient,
  });

  // TODO: implement fetching meta data for space tokens

  const symbol = await contract.read.symbol();
  try {
    return {
      symbol: symbol,
      icon: '/placeholder/eth.png',
      name: symbol,
      status: 'utility',
    };
  } catch (error: any) {
    console.error(`Failed to fetch symbol for token ${tokenAddress}:`, error);
    throw new Error(`Could not retrieve token symbol: ${error.message}`);
  }
}
