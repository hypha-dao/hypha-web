import { publicClient } from '@core/common/web3/public-client';
import { erc20Abi, getContract } from 'viem';

export async function getTokenSymbol(
  tokenAddress: `0x${string}`,
): Promise<string> {
  const contract = getContract({
    address: tokenAddress,
    abi: erc20Abi,
    client: publicClient,
  });

  try {
    return await contract.read.symbol();
  } catch (error: any) {
    console.error(`Failed to fetch symbol for token ${tokenAddress}:`, error);
    throw new Error(`Could not retrieve token symbol: ${error.message}`);
  }
}
