'use server';

import { TOKENS, Token, DbToken, TokenType } from '@hypha-platform/core/client';
import { findSpaceById } from '../../../server';
import { erc20Abi } from 'viem';
import { web3Client } from './client';
import { db } from '@hypha-platform/storage-postgres';

function getIconForHyphaTokens(symbol: string, fallback: string): string {
  switch (symbol.toUpperCase()) {
    case 'HYPHA':
      return '/placeholder/hypha-token-icon.svg';
    case 'HVOICE':
      return '/placeholder/voice-token-icon.svg';
    case 'HCREDITS':
      return '/placeholder/credits-token-icon.svg';
    default:
      return fallback;
  }
}

function getHyphaTokensType(symbol: string): TokenType | null {
  switch (symbol.toUpperCase()) {
    case 'HYPHA':
      return 'utility';
    case 'HVOICE':
      return 'voice';
    case 'HCREDITS':
      return 'credits';
    default:
      return null;
  }
}

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
    const { symbol, name, type } = stable;
    const dbToken = dbTokens?.find(
      (t) => t.symbol.toUpperCase() === symbol.toUpperCase(),
    );

    let space = null;
    if (dbToken?.spaceId) {
      space = await findSpaceById({ id: dbToken.spaceId }, { db });
    }

    const icon = getIconForHyphaTokens(symbol, dbToken?.iconUrl ?? stable.icon);

    return {
      symbol,
      name,
      type,
      icon,
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
      (t) => t.address?.toUpperCase() === tokenAddress.toUpperCase(),
    );

    const icon = getIconForHyphaTokens(
      symbol,
      dbToken?.iconUrl ?? '/placeholder/neutral-token-icon.svg',
    );

    const hyphaTokenType = getHyphaTokensType(symbol);

    let space = null;
    if (dbToken?.spaceId) {
      space = await findSpaceById({ id: dbToken.spaceId }, { db });
    }

    return {
      symbol,
      name,
      icon,
      type: hyphaTokenType || dbToken?.type || null,
      ...(space && { space: { slug: space.slug, title: space.title } }),
    };
  } catch (error: any) {
    console.error(`Failed to fetch token info for ${tokenAddress}:`, error);
    throw new Error(`Could not retrieve token info: ${error.message}`);
  }
}
