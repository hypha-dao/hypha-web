'use server';

import { web3Client } from './client';
import { erc20Abi, formatUnits } from 'viem';

export async function getBalance(
  tokenAddress: `0x${string}`,
  ownerAddress: `0x${string}`,
): Promise<{ amount: number; symbol: string }> {
  const contract = {
    abi: erc20Abi,
    address: tokenAddress,
  };

  try {
    const [amount, decimals, symbol] = await web3Client.multicall({
      allowFailure: false,
      blockTag: 'safe',
      contracts: [
        {
          ...contract,
          functionName: 'balanceOf',
          args: [ownerAddress],
        },
        {
          ...contract,
          functionName: 'decimals',
          args: [],
        },
        {
          ...contract,
          functionName: 'symbol',
          args: [],
        },
      ],
    });

    return {
      amount: +formatUnits(amount, decimals),
      symbol,
    };
  } catch (error: any) {
    throw new Error(
      `Failed to fetch balance of ${ownerAddress} for token ${tokenAddress}: ${error}`,
    );
  }
}
