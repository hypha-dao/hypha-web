'use server';

import { web3Client } from './client';
import { TOKENS, Token } from '@hypha-platform/core/client';
import { erc20Abi } from 'viem';

export async function getTokenMeta(
  tokenAddress: `0x${string}`,
): Promise<Omit<Token, 'address'>> {
  const stable = TOKENS.find(
    (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
  );
  if (stable) {
    return stable;
  }

  // TODO: implement fetching meta data for space tokens

  const contract = {
    address: tokenAddress,
    abi: erc20Abi,
  } as const;

  try {
    const [symbol, name] = await web3Client.multicall({
      allowFailure: false,
      blockTag: 'safe',
      contracts: [
        {
          ...contract,
          functionName: 'symbol',
          args: [],
        },
        {
          ...contract,
          functionName: 'name',
          args: [],
        },
      ],
    });

    return {
      symbol,
      name,
      icon: '/placeholder/token-icon.png',
      type: 'utility',
    };
  } catch (error) {
    throw new Error(`Failed to fetch token info for ${tokenAddress}: ${error}`);
  }
}
