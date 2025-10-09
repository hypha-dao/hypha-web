import { checkSpaceSlugExists } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    // TODO: implement authorization
    const { exists, spaceId } = await checkSpaceSlugExists(
      { slug: spaceSlug },
      { db },
    );
    return NextResponse.json({ exists, spaceId });
  } catch (error) {
    console.error('Failed to check space existence:', error);
    return NextResponse.json(
      { error: 'Failed to check space' },
      { status: 500 },
    );
  }
}
