import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getTokenBalancesByAddress,
  getTokenMeta,
  web3Client,
  findAllTokens,
} from '@hypha-platform/core/server';
import {
  getSpaceRegularTokens,
  getSpaceDecayingTokens,
  getSpaceOwnershipTokens,
  Token,
  TOKENS,
  ALLOWED_SPACES,
} from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { hasEmojiOrLink } from '@hypha-platform/ui-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    // TODO: implement authorization
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const spaceAddress = space.address as `0x${string}`;
    if (!spaceAddress || !/^0x[a-fA-F0-9]{40}$/.test(spaceAddress)) {
      return NextResponse.json(
        { error: 'Invalid or missing space address' },
        { status: 400 },
      );
    }

    const spaceId = BigInt(space.web3SpaceId as number);

    const rawDbTokens = await findAllTokens({ db }, { search: undefined });
    const dbTokens = rawDbTokens.map((token) => ({
      agreementId: token.agreementId ?? undefined,
      spaceId: token.spaceId ?? undefined,
      name: token.name,
      symbol: token.symbol,
      maxSupply: token.maxSupply,
      type: token.type as 'utility' | 'credits' | 'ownership' | 'voice',
      iconUrl: token.iconUrl ?? undefined,
      transferable: token.transferable,
      isVotingToken: token.isVotingToken,
      address: token.address ?? undefined,
    }));

    let regularTokens: readonly `0x${string}`[] = [];
    let ownershipTokens: readonly `0x${string}`[] = [];
    let decayingTokens: readonly `0x${string}`[] = [];
    try {
      const [regularResult, ownershipResult, decayingResult] =
        await web3Client.multicall({
          contracts: [
            getSpaceRegularTokens({ spaceId }),
            getSpaceOwnershipTokens({ spaceId }),
            getSpaceDecayingTokens({ spaceId }),
          ],
        });
      regularTokens =
        regularResult.status === 'success' && regularResult.result.length !== 0
          ? regularResult.result
          : [];
      ownershipTokens =
        ownershipResult.status === 'success' &&
        ownershipResult.result.length !== 0
          ? ownershipResult.result
          : [];
      decayingTokens =
        decayingResult.status === 'success' &&
        decayingResult.result.length !== 0
          ? decayingResult.result
          : [];
    } catch (err: any) {
      const errorMessage =
        err?.message || err?.shortMessage || JSON.stringify(err);
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        console.warn(
          'Rate limit exceeded when calling readContract:',
          errorMessage,
        );
        return NextResponse.json(
          {
            error: 'External API rate limit exceeded. Please try again later.',
          },
          { status: 503 },
        );
      }

      console.error('Error while calling readContract:', err);
      return NextResponse.json(
        { error: 'Failed to fetch contract data.' },
        { status: 500 },
      );
    }

    let externalTokens: any[] = [];
    try {
      externalTokens = await getTokenBalancesByAddress(spaceAddress);
    } catch (error: unknown) {
      console.warn('Failed to fetch external token balances:', error);
    }

    const parsedExternalTokens: Token[] = externalTokens
      .filter(
        (token) =>
          token?.tokenAddress &&
          /^0x[a-fA-F0-9]{40}$/i.test(token.tokenAddress),
      )
      .map((token) => ({
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unnamed',
        address: token.tokenAddress as `0x${string}`,
        icon: token.logo || '/placeholder/token-icon.svg',
        type: 'utility' as const,
      }));

    const addressMap = new Map<string, Token>();
    const filteredTokens = TOKENS.filter((token) => {
      return token.symbol === 'HYPHA'
        ? ALLOWED_SPACES.includes(spaceAddress)
        : true;
    });
    filteredTokens.forEach((token) =>
      addressMap.set(token.address.toLowerCase(), token),
    );

    regularTokens.forEach((address) => {
      if (!addressMap.has(address.toLowerCase())) {
        addressMap.set(address.toLowerCase(), {
          symbol: '',
          name: '',
          address,
          icon: '/placeholder/token-icon.svg',
          type: 'utility',
        });
      } else {
        addressMap.set(address.toLowerCase(), {
          ...addressMap.get(address.toLowerCase())!,
          type: 'utility',
        });
      }
    });

    ownershipTokens.forEach((address) => {
      if (!addressMap.has(address.toLowerCase())) {
        addressMap.set(address.toLowerCase(), {
          symbol: '',
          name: '',
          address,
          icon: '/placeholder/token-icon.svg',
          type: 'ownership',
        });
      } else {
        addressMap.set(address.toLowerCase(), {
          ...addressMap.get(address.toLowerCase())!,
          type: 'ownership',
        });
      }
    });

    decayingTokens.forEach((address) => {
      if (!addressMap.has(address.toLowerCase())) {
        addressMap.set(address.toLowerCase(), {
          symbol: '',
          name: '',
          address,
          icon: '/placeholder/token-icon.svg',
          type: 'voice',
        });
      } else {
        addressMap.set(address.toLowerCase(), {
          ...addressMap.get(address.toLowerCase())!,
          type: 'voice',
        });
      }
    });

    parsedExternalTokens.forEach((token) => {
      if (!addressMap.has(token.address.toLowerCase())) {
        addressMap.set(token.address.toLowerCase(), token);
      }
    });

    const allTokens: Token[] = Array.from(addressMap.values());

    const assets = await Promise.all(
      allTokens.map(async (token) => {
        try {
          const meta = await getTokenMeta(token.address, dbTokens);
          if (hasEmojiOrLink(meta.name) || hasEmojiOrLink(meta.symbol)) {
            return null;
          }
          return {
            ...meta,
            address: token.address,
          };
        } catch (err) {
          console.warn(`Skipping token ${token.address}: ${err}`);
          return null;
        }
      }),
    );

    const validAssets = assets.filter((a) => a !== null) as NonNullable<
      (typeof assets)[0]
    >[];

    return NextResponse.json({ assets: validAssets });
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets.' },
      { status: 500 },
    );
  }
}
