import { NextRequest, NextResponse } from 'next/server';
import {
  findPersonByAddresses,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { getSpaceDetails } from '@hypha-platform/core/client';
import { publicClient } from '@hypha-platform/core/client';
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

    const [, , , , members] = spaceDetails;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '4', 10);
    const searchTerm = url.searchParams.get('searchTerm') || undefined;

    const result = await findPersonByAddresses(
      members as `0x${string}`[],
      { pagination: { page, pageSize }, searchTerm },
      { db },
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members.' },
      { status: 500 },
    );
  }
}
