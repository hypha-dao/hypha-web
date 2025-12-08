import { NextRequest, NextResponse } from 'next/server';
import {
  findPersonByAddresses,
  findSpaceBySlug,
  findSpaceByAddresses,
} from '@hypha-platform/core/server';
import { getSpaceDetails } from '@hypha-platform/core/client';
import { publicClient } from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

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
      spaceDetails = canConvertToBigInt(space.web3SpaceId)
        ? await publicClient.readContract(
            getSpaceDetails({ spaceId: BigInt(space.web3SpaceId as number) }),
          )
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

    const [, , , , members = []] = spaceDetails;

    const url = new URL(request.url);
    const pageRaw = url.searchParams.get('page');
    const pageSizeRaw = url.searchParams.get('pageSize');
    const searchTerm = url.searchParams.get('searchTerm') || undefined;

    const page = pageRaw != null ? Number.parseInt(pageRaw, 10) : undefined;
    const pageSize =
      pageSizeRaw != null ? Number.parseInt(pageSizeRaw, 10) : undefined;
    const hasValidPagination =
      Number.isInteger(page) &&
      page! > 0 &&
      Number.isInteger(pageSize) &&
      pageSize! > 0;
    const paginationOptions = hasValidPagination
      ? { pagination: { page: page!, pageSize: pageSize! } }
      : {};

    const persons = await findPersonByAddresses(
      members as `0x${string}`[],
      { ...paginationOptions, searchTerm },
      { db },
    );

    const spaces = await findSpaceByAddresses(
      members as `0x${string}`[],
      { ...paginationOptions, searchTerm },
      { db },
    );

    return NextResponse.json({
      persons,
      spaces,
    });
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members.' },
      { status: 500 },
    );
  }
}
