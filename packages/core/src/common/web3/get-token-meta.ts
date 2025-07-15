import { publicClient, TOKENS, Token } from '@hypha-platform/core/client';
import { erc20Abi } from 'viem';

export async function getTokenMeta(
  tokenAddress: `0x${string}`,
): Promise<Omit<Token, 'address'>> {
  const stable = TOKENS.find((token) => token.address == tokenAddress);
  if (stable) {
    return stable;
  }

  // TODO: implement fetching meta data for space tokens

  const contract = {
    address: tokenAddress,
    abi: erc20Abi,
  } as const;

  try {
    const results = await publicClient.multicall({
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
    const failure = results.find((result) => result.status === 'failure');
    if (failure?.error) throw failure.error;

    // Check above will eliminate undefined results
    const [symbol, name] = results.map(({ result }) => result as string);

    return {
      symbol: symbol ?? 'MISSING SYMBOL',
      icon: '/placeholder/token-icon.png',
      name: name ?? 'MISSING NAME',
      status: 'utility',
    };
  } catch (error: any) {
    console.error(`Failed to fetch token info for ${tokenAddress}:`, error);
    throw new Error(`Could not retrieve token info: ${error.message}`);
  }
}
