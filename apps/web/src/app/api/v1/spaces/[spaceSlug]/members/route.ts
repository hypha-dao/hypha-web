import { NextRequest, NextResponse } from 'next/server';
import {
  findPersonByAddresses,
  findSpaceBySlug,
  findSpaceByAddresses,
} from '@hypha-platform/core/server';
import {
  getSpaceDetails,
  getDelegatesForSpace,
} from '@hypha-platform/core/client';
import { publicClient } from '@hypha-platform/core/client';
import { db } from '@hypha-platform/storage-postgres';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const spaceId = BigInt(space.web3SpaceId as number);

    let spaceDetails;
    try {
      spaceDetails = await publicClient.readContract(
        getSpaceDetails({ spaceId }),
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

    let delegates: `0x${string}`[] = [];
    try {
      delegates = (await publicClient.readContract(
        getDelegatesForSpace({ spaceId }),
      )) as `0x${string}`[];
      console.log('Delegates from contract:', delegates);
    } catch (err: any) {
      const errorMessage =
        err?.message || err?.shortMessage || JSON.stringify(err);
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        console.warn(
          'Rate limit exceeded when calling readContract for delegates:',
          errorMessage,
        );
        return NextResponse.json(
          {
            error: 'External API rate limit exceeded. Please try again later.',
          },
          { status: 503 },
        );
      }

      console.error('Error while calling readContract for delegates:', err);
      return NextResponse.json(
        { error: 'Failed to fetch delegates data.' },
        { status: 500 },
      );
    }

    const allAddresses = Array.from(
      new Set([...(members as `0x${string}`[]), ...delegates]),
    );

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

    const personsResponse = await findPersonByAddresses(
      allAddresses,
      { ...paginationOptions, searchTerm },
      { db },
    );

    const delegatesSet = new Set(
      delegates.map((addr) => addr.toLowerCase() as `0x${string}`),
    );

    const enhancedData = personsResponse.data.map((person: any) => {
      const isDelegate =
        delegatesSet.has(
          (person.address?.toLowerCase() ?? '') as `0x${string}`,
        ) || false;
      return {
        ...person,
        isDelegate,
      };
    });

    const enhancedPersons = { ...personsResponse, data: enhancedData };

    const spaces = await findSpaceByAddresses(
      allAddresses,
      { ...paginationOptions, searchTerm },
      { db },
    );

    return NextResponse.json({
      persons: enhancedPersons,
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
