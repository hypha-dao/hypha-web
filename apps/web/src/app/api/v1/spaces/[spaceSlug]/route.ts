import { createSpaceService } from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  try {
    const spaceService = createSpaceService({ authToken });
    const space = await spaceService.getBySlug({ slug: spaceSlug });
    return NextResponse.json(space);
  } catch (error) {
    console.error('Failed to fetch spaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space' },
      { status: 500 },
    );
  }
}
