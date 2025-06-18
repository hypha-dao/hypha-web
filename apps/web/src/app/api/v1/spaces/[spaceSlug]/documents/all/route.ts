import { NextRequest, NextResponse } from 'next/server';

import { createDocumentService } from '@hypha-platform/core/server';

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

    const documents = await documentsService.getAllBySpaceSlugWithoutPagination(
      {
        spaceSlug: spaceSlug,
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
