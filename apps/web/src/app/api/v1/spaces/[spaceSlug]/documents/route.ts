import { NextRequest, NextResponse } from 'next/server';

import { createDocumentService } from '@hypha-platform/core';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  // Get token from Authorization header
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  try {
    const documentsService = createDocumentService({ authToken });

    // Get URL parameters for pagination
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10);
    const state = url.searchParams.get('state');

    const filter = {
      ...(state ? { state } : {}),
    };

    const paginatedDocuments = await documentsService.getAllBySpaceSlug(
      { spaceSlug },
      { pagination: { page, pageSize }, filter },
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
