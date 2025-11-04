import {
  findAllSpacesByMemberId,
  findPersonBySlug,
  getDb,
} from '@hypha-platform/core/server';
import { ProfileRouteParams } from '@hypha-platform/epics';
import { db } from '@hypha-platform/storage-postgres';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<ProfileRouteParams> },
) {
  const { personSlug: personSlugRaw } = await params;
  const personSlug = tryDecodeUriPart(personSlugRaw);
  console.debug(`GET /api/v1/people/${personSlug}/spaces`);

  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';

  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // First, get the person by slug
    const person = await findPersonBySlug(
      { slug: personSlug },
      { db: getDb({ authToken }) },
    );

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // Then, get all spaces for this person using their ID
    const spaces = await findAllSpacesByMemberId(
      { memberId: person.id },
      // TODO: implement authorization
      { db },
    );

    return NextResponse.json(spaces);
  } catch (error) {
    console.error('Failed to fetch spaces for person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spaces for person' },
      { status: 500 },
    );
  }
}
