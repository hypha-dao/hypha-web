'use server';

import { web3Client } from './client';
import { erc20Abi, getContract } from 'viem';

export async function getTokenDecimals(
  tokenAddress: `0x${string}`,
): Promise<number> {
  const contract = getContract({
    address: tokenAddress,
    abi: erc20Abi,
    client: web3Client,
  });

  try {
    return await contract.read.decimals();
  } catch (error) {
    throw new Error(
      `Failed to fetch decimals for token ${tokenAddress}: ${error}`,
    );
  }
}
