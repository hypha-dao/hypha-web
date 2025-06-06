import { NextRequest, NextResponse } from 'next/server';
import { createSpaceService } from '@hypha-platform/core/server';
import { getSpaceDetails } from '@core/space';
import { publicClient } from '@core/common';
import { TOKENS } from './_tokens';
import { Erc20Provider, AssetProvider } from './_asset-provider';
import { paginate } from './_paginator';

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

    let spaceDetails;
    try {
      spaceDetails = await publicClient.readContract(
        getSpaceDetails({ spaceId: BigInt(space.web3SpaceId as number) }),
      );
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

    const [
      /*unity*/,
      /*quorum*/,
      /*votingPowerSource*/,
      tokenAdresses,
      /*members*/,
      /*exitMethod*/,
      /*joinMethod*/,
      /*createdAt*/,
      /*creator*/,
      spaceAddress,
    ] = spaceDetails;

    const assets = await Promise.all(tokenAdresses
      .map((token, index) => new Erc20Provider({
        client: publicClient,
        token: token,
        slug: `${token}-${index}`,
      }) as AssetProvider)
      .concat(TOKENS)
      .map(provider => provider.formItem(spaceAddress)));
    const sorted = assets.sort((a, b) => a.usdEqual === b.usdEqual
      ? b.value - a.value
      : b.usdEqual - a.usdEqual);

    const url = new URL(request.url)
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
        { status: 400 }
      );
    }
    if (
      parsedPageSize !== undefined &&
      (!Number.isInteger(parsedPageSize) || parsedPageSize < 1)
    ) {
      return NextResponse.json(
        { error: 'Invalid pageSize parameter' },
        { status: 400 }
      );
    }

    const paginated = paginate(
      sorted,
      {
        page: parsedPage,
        pageSize: parsedPageSize,
        filter: status ? { status } : {},
      },
    )

    return NextResponse.json({
      assets: paginated.paginatedData,
      pagination: paginated.pagination,
      balance: sorted.reduce((sum, asset) => sum + (asset.usdEqual), 0)
    });
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets.' },
      { status: 500 },
    );
  }
}
