import { NextRequest, NextResponse } from 'next/server';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import {
  getSpaceDetails,
  getSpaceRegularTokens,
  getSpaceDecayingTokens,
  getSpaceOwnershipTokens,
} from '@hypha-platform/core/client';
import {
  TOKENS,
  publicClient,
  getBalance,
  getTokenMeta,
} from '@hypha-platform/core/client';
import { getTokenPrice } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export async function GET(
  _: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    // TODO: implement authorization
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const spaceId = BigInt(space.web3SpaceId as number);

    let spaceDetails;
    let spaceTokens;
    try {
      spaceDetails = await publicClient.readContract(
        getSpaceDetails({ spaceId }),
      );

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

    let prices: Record<string, number | undefined> = {};
    try {
      prices = await getTokenPrice(TOKENS.map(({ address }) => address));
    } catch (error: unknown) {
      console.error('Failed to fetch prices of tokens with Moralis:', error);
    }

    const spaceAddress = spaceDetails.at(-1) as `0x${string}`;

    spaceTokens = spaceTokens
      .filter(
        (response) =>
          response.status === 'success' && response.result.length !== 0,
      )
      .map(({ result }) => result)
      .flat() as `0x${string}`[];

    const assets = await Promise.all(
      TOKENS.map((token) => token.address)
        .concat(spaceTokens)
        .map(async (token) => {
          const meta = await getTokenMeta(token);
          const { amount } = await getBalance(token, spaceAddress);
          const rate = prices[token] || 0;

          return {
            ...meta,
            value: amount,
            usdEqual: rate * amount,
            chartData: [],
            transactions: [],
            closeUrl: [],
            slug: '',
          };
        }),
    );

    const sorted = assets.sort((a, b) =>
      a.usdEqual === b.usdEqual ? b.value - a.value : b.usdEqual - a.usdEqual,
    );

    return NextResponse.json({
      assets: sorted,
      balance: sorted.reduce((sum, asset) => sum + asset.usdEqual, 0),
    });
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets.' },
      { status: 500 },
    );
  }
}
