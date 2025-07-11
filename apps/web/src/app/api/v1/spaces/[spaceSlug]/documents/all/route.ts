import { NextRequest, NextResponse } from 'next/server';

import { findAllDocumentsBySpaceSlugWithoutPagination } from '@hypha-platform/core/server';
import { getOrder } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    // Get URL parameters for order
    const url = new URL(request.url);
    const orderString = url.searchParams.get('order') || undefined;

    const order = getOrder(orderString);

    // TODO: implement authorization
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
