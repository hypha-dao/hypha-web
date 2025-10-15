import { findPersonBySlug } from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import { ProfileRouteParams } from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<ProfileRouteParams> },
) {
  const { personSlug: personSlugRaw } = await params;
  const personSlug = tryDecodeUriPart(personSlugRaw);
  console.debug(`GET /api/v1/people/${personSlug}/`);

  try {
    const response = await findPersonBySlug({ slug: personSlug }, { db });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 },
    );
  }
}
