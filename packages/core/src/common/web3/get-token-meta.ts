import { TOKENS, Token, DbToken } from '@hypha-platform/core/client';
import { erc20Abi } from 'viem';
import { web3Client } from '../server';

export async function getTokenMeta(
  tokenAddress: `0x${string}`,
  dbTokens?: DbToken[],
): Promise<Omit<Token, 'address'>> {
  const stableToken = TOKENS.find(
    (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
  );
  if (stableToken) {
    const { symbol, icon, name, type } = stableToken;
    const dbToken = dbTokens?.find(
      (t) => t.symbol.toUpperCase() === symbol.toUpperCase(),
    );
    return {
      symbol,
      name,
      type,
      icon: dbToken?.iconUrl ?? icon,
    };
  }

  const contract = {
    address: tokenAddress,
    abi: erc20Abi,
  } as const;

  try {
    const results = await web3Client.multicall({
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
    if (failure?.error) {
      throw new Error(`Contract call failed: ${failure.error.message}`);
    }

    const [symbolResult, nameResult] = results.map(
      ({ result }) => result as string,
    );

    const symbol = symbolResult || 'MISSING SYMBOL';
    const name = nameResult || 'MISSING NAME';

    const dbToken = dbTokens?.find(
      (t) => t.symbol.toUpperCase() === symbol.toUpperCase(),
    );
    const icon = dbToken?.iconUrl ?? '/placeholder/token-icon.png';

    return {
      symbol,
      name,
      icon,
      type: 'utility',
    };
  } catch (error: any) {
    console.error(`Failed to fetch token info for ${tokenAddress}:`, error);
    throw new Error(`Could not retrieve token info: ${error.message}`);
  }
}
