import { NextRequest, NextResponse } from 'next/server';

import { getOrder } from '@hypha-platform/core/client';
import {
  findAllDocumentsBySpaceSlug,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

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

    if (space.web3SpaceId) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );

      if (!hasAccess && response) {
        return response;
      }
    }
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
    const state = url.searchParams.get('state');
    const searchTerm = url.searchParams.get('searchTerm') || undefined;
    const orderString = url.searchParams.get('order') || undefined;

    // @ts-ignore: TODO: fix this
    const order = getOrder(orderString);

    const filter = {
      ...(state ? { state } : {}),
    };

    const paginatedDocuments = await findAllDocumentsBySpaceSlug(
      { spaceSlug },
      // @ts-ignore: TODO: order type
      { pagination: { page, pageSize, order }, filter, searchTerm, db },
    );

    return NextResponse.json(paginatedDocuments);
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 },
    );
  }
}
