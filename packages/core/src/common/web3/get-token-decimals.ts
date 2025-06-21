import { publicClient } from '@core/common/web3/public-client';
import { erc20Abi, getContract } from 'viem';

export async function getTokenDecimals(tokenAddress: string): Promise<number> {
  const contract = getContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    client: publicClient,
  });

  try {
    return await contract.read.decimals();
  } catch (error: any) {
    console.error(`Failed to fetch decimals for token ${tokenAddress}:`, error);
    throw new Error(`Could not retrieve token decimals: ${error.message}`);
  }
}
