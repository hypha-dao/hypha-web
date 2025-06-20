import { NextRequest, NextResponse } from 'next/server';

import { createDocumentService } from '@hypha-platform/core/server';
import { getOrder } from '@core/common/server';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  // Get token from Authorization header
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  try {
    const documentsService = createDocumentService({ authToken });

    // Get URL parameters for order
    const url = new URL(request.url);
    const orderString = url.searchParams.get('order') || undefined;

    const order = getOrder(orderString);

    const documents = await documentsService.getAllBySpaceSlugWithoutPagination(
      {
        spaceSlug: spaceSlug,
        order: order,
      },
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
