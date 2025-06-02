import { NextRequest, NextResponse } from 'next/server';
import { createSpaceService } from '@hypha-platform/core/server';
import { getSpaceDetails } from '@core/space';
import { publicClient } from '@core/common';
import { ASSETS_PROVIDERS } from './_constants';
import { Erc20Provider } from './_asset-providers';
import { AssetProvider } from './_interface';
import { paginate } from './_pagination-applier';

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
      .map((token, index) => new Erc20Provider(
        publicClient,
        token,
        {
          slug: `${spaceSlug}-${index}`,
        }
      ) as AssetProvider)
      .concat(ASSETS_PROVIDERS[publicClient.chain.id])
      .map(provider => provider.formItem(spaceAddress)));
    const sorted = assets.sort((a, b) => a.usdEqual == b.usdEqual
      ? b.value - a.value
      : b.usdEqual - a.usdEqual);

    const url = new URL(request.url)
    const page = url.searchParams.get('page');
    const pageSize = url.searchParams.get('pageSize');
    const status = url.searchParams.get('status');

    const paginated = paginate(
      sorted,
      {
        page: page ? Number(page) : undefined,
        pageSize: pageSize ? Number(pageSize) : undefined,
        filter: status ? { status } : {},
      },
    )

    return NextResponse.json({
      ...paginated,
    });
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assets.' },
      { status: 500 },
    );
  }
}
