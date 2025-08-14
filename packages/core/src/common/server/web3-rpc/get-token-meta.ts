'use server';

import { TOKENS, Token, DbToken } from '@hypha-platform/core/client';
import { findSpaceById } from '../../../server';
import { erc20Abi } from 'viem';
import { web3Client } from './client';
import { db } from '@hypha-platform/storage-postgres';

export async function getTokenMeta(
  tokenAddress: `0x${string}`,
  dbTokens?: DbToken[],
): Promise<
  Omit<Token, 'address'> & { space?: { slug: string; title: string } }
> {
  const stable = TOKENS.find(
    (token) => token.address.toLowerCase() === tokenAddress.toLowerCase(),
  );
  if (stable) {
    const { symbol, icon, name, type } = stable;
    const dbToken = dbTokens?.find(
      (t) => t.symbol.toUpperCase() === symbol.toUpperCase(),
    );

    let space = null;
    if (dbToken?.spaceId) {
      space = await findSpaceById({ id: dbToken.spaceId }, { db });
    }

    return {
      symbol,
      name,
      type,
      icon: dbToken?.iconUrl ?? icon,
      ...(space && { space: { slug: space.slug, title: space.title } }),
    };
  }

  const contract = {
    address: tokenAddress,
    abi: erc20Abi,
  } as const;

  try {
    const results = await web3Client.multicall({
      allowFailure: true,
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

    let space = null;
    if (dbToken?.spaceId) {
      space = await findSpaceById({ id: dbToken.spaceId }, { db });
    }

    return {
      symbol,
      name,
      icon,
      type: 'utility',
      ...(space && { space: { slug: space.slug, title: space.title } }),
    };
  } catch (error: any) {
    console.error(`Failed to fetch token info for ${tokenAddress}:`, error);
    throw new Error(`Could not retrieve token info: ${error.message}`);
  }
}
