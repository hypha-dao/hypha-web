'use client';

import { publicClient } from '@core/common/web3/public-client';
import { encodeFunctionData, erc20Abi, getContract, parseUnits } from 'viem';

export async function getTokenDecimals(tokenAddress: string): Promise<number> {
  const contract = getContract({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    client: publicClient,
  });

  return await contract.read.decimals();
}
