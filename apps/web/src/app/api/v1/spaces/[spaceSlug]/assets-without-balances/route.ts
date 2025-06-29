import { NextRequest, NextResponse } from 'next/server';
import { createSpaceService } from '@hypha-platform/core/server';
import {
  getSpaceRegularTokens,
  getSpaceDecayingTokens,
  getSpaceOwnershipTokens,
} from '@core/space';
import { getTokenMeta, publicClient } from '@core/common';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    const spaceService = createSpaceService();

    const space = await spaceService.getBySlug({ slug: spaceSlug });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
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

    spaceTokens = spaceTokens
      .filter(
        (response) =>
          response.status === 'success' && response.result.length !== 0,
      )
      .map(({ result }) => result)
      .flat() as `0x${string}`[];

    const assets = await Promise.all(
      spaceTokens.map(async (token) => {
        const meta = await getTokenMeta(token);
        return {
          address: token,
          name: meta.name,
        };
      }),
    );

    return NextResponse.json({ assets });
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets.' },
      { status: 500 },
    );
  }
}
