import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getPayingSpacesMetrics,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

export const maxDuration = 300;

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space?.web3SpaceId || !canConvertToBigInt(space.web3SpaceId)) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    const { hasAccess, response } = await checkSpaceAccess(
      request,
      space.web3SpaceId as number,
    );
    if (!hasAccess && response) {
      return response;
    }

    const payingSpaces = await getPayingSpacesMetrics({ db });

    return NextResponse.json(
      {
        found: true,
        space_slug: spaceSlug,
        asOf: new Date().toISOString(),
        ...payingSpaces,
      },
      {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    console.error('Failed to fetch overview flows:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview flows' },
      { status: 500 },
    );
  }
}
