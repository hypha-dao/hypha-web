import { NextRequest, NextResponse } from 'next/server';
import { createSpaceService } from '@hypha-platform/core/server';
import {
  getSpaceDetails,
  getSpaceRegularTokens,
  getSpaceDecayingTokens,
  getSpaceOwnershipTokens,
} from '@core/space';
import { TOKENS, publicClient, getBalance, getTokenMeta } from '@core/common';
import { paginate } from '@core/common/server';

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

          return {
            ...meta,
            value: amount,
            usdEqual: 0,
            chartData: [],
            transactions: [],
            closeUrl: [],
            slug: '',
          };
        }),
    );
    const sorted = assets.sort((a, b) =>
      a.usdEqual === b.usdEqual ? b.usdEqual - a.usdEqual : b.value - a.value,
    );

    const url = new URL(request.url);
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('pageSize');
    const status = url.searchParams.get('status');

    const parsedPage = page ? Number(page) : undefined;
    const parsedPageSize = pageSize ? Number(pageSize) : undefined;
    if (
      parsedPage !== undefined &&
      (!Number.isInteger(parsedPage) || parsedPage < 1)
    ) {
      return NextResponse.json(
        { error: 'Invalid page parameter' },
        { status: 400 },
      );
    }
    if (
      parsedPageSize !== undefined &&
      (!Number.isInteger(parsedPageSize) || parsedPageSize < 1)
    ) {
      return NextResponse.json(
        { error: 'Invalid pageSize parameter' },
        { status: 400 },
      );
    }

    const paginated = paginate(sorted, {
      page: parsedPage,
      pageSize: parsedPageSize,
      filter: status ? { status } : {},
    });

    return NextResponse.json({
      assets: paginated.data,
      pagination: paginated.pagination,
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
