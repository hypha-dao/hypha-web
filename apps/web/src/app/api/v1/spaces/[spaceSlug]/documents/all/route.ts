import { NextRequest, NextResponse } from 'next/server';

import {
  findAllDocumentsBySpaceSlugWithoutPagination,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { getOrder } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );

      if (!hasAccess && response) {
        return response;
      }
    }

    // Get URL parameters for order
    const url = new URL(request.url);
    const orderString = url.searchParams.get('order') || undefined;

    const order = getOrder(orderString);

    const documents = await findAllDocumentsBySpaceSlugWithoutPagination(
      {
        spaceSlug,
        order,
      },
      { db },
    );

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Failed to fetch space documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space documents' },
      { status: 500 },
    );
  }
}
