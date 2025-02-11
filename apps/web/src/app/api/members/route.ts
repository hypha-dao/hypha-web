import { fetchSpaceMemberBySpaceSlug } from '@hypha-platform/epics';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const spaceSlug = searchParams.get('spaceSlug');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    if (!spaceSlug) {
      return NextResponse.json(
        { error: 'Space slug is required' },
        { status: 400 },
      );
    }

    const members = await fetchSpaceMemberBySpaceSlug(
      { spaceSlug },
      { pagination: { page, pageSize } },
    );

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members' },
      { status: 500 },
    );
  }
}
