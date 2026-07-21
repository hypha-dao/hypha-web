import { NextRequest, NextResponse } from 'next/server';
import {
  buildPaginatedResponse,
  listPublishedHighlightProfiles,
  parseHttpPaginationParams,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export async function GET(request: NextRequest) {
  try {
    const { page, pageSize, offset } = parseHttpPaginationParams(
      new URL(request.url),
      { defaultPageSize: 24, maxPageSize: 100 },
    );

    const { items, total } = await listPublishedHighlightProfiles(
      { page, pageSize, offset },
      { db },
    );

    return NextResponse.json(
      buildPaginatedResponse(items, total, page, pageSize),
    );
  } catch (error) {
    console.error('Failed to list marketplace profiles:', error);
    return NextResponse.json(
      { error: 'Failed to list marketplace profiles' },
      { status: 500 },
    );
  }
}
