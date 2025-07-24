import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getWalletTokenBalancesPriceByAddress,
} from '@hypha-platform/core/server';
import {
  getSpaceRegularTokens,
  getSpaceDecayingTokens,
  getSpaceOwnershipTokens,
  getTokenMeta,
  publicClient,
  Token,
} from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';

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

    let spaceTokens;
    try {
      spaceTokens = await publicClient.multicall({
        contracts: [
          getSpaceRegularTokens({ spaceId }),
          getSpaceOwnershipTokens({ spaceId }),
          getSpaceDecayingTokens({ spaceId }),
        ],
      });
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
      externalTokens = await getWalletTokenBalancesPriceByAddress(spaceAddress);
    } catch (error: unknown) {
      console.warn('Failed to fetch external token balances:', error);
    }

    const parsedExternalTokens: Token[] = externalTokens
      .filter(
        (token) =>
          token?.tokenAddress?.lowercase &&
          /^0x[a-fA-F0-9]{40}$/i.test(token.tokenAddress.lowercase),
      )
      .map((token) => ({
        symbol: token.symbol || 'UNKNOWN',
        name: token.name || 'Unnamed',
        address: token?.tokenAddress?.lowercase as `0x${string}`,
        icon: token.logo || '/placeholder/token-icon.png',
        status: 'utility',
      }));

    spaceTokens = spaceTokens
      .filter(
        (response) =>
          response.status === 'success' && response.result.length !== 0,
      )
      .map(({ result }) => result)
      .flat() as `0x${string}`[];

    const allTokens: Token[] = [
      ...spaceTokens.map((address) => ({
        symbol: '',
        name: '',
        address,
        icon: '/placeholder/token-icon.png',
        status: 'utility' as const,
      })),
      ...parsedExternalTokens,
    ].filter(
      (token, index, self) =>
        index ===
        self.findIndex(
          (t) => t.address.toLowerCase() === token.address.toLowerCase(),
        ),
    );

    const assets = await Promise.all(
      allTokens.map(async (token) => {
        try {
          const meta = await getTokenMeta(token.address);
          return {
            address: token.address,
            name: meta.name || token.name || 'Unnamed',
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
