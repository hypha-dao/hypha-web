import { findPersonBySlug } from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import { ProfileRouteParams } from '@hypha-platform/epics';
import { tryDecodeUriPart } from '@hypha-platform/ui-utils';
import { resolveMappedHostScope } from '../../../../../lib/white-label/mapped-host-scope';
import {
  isMemberOfMappedSpace,
  toHostPerson,
} from '../../../../../lib/white-label/mapped-host-people';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<ProfileRouteParams> },
) {
  const { personSlug: personSlugRaw } = await params;
  const personSlug = tryDecodeUriPart(personSlugRaw);
  console.debug(`GET /api/v1/people/${personSlug}/`);

  try {
    const response = await findPersonBySlug({ slug: personSlug }, { db });

    // Mapped host (Space header set by middleware): a member of the host's own
    // Space only, without email or sub. No header means the main app, unchanged.
    const scope = await resolveMappedHostScope(request, { db });
    if (scope.kind !== 'main') {
      if (!response || !(await isMemberOfMappedSpace(scope, response.address))) {
        return NextResponse.json(
          { error: 'Person not found' },
          { status: 404 },
        );
      }
      return NextResponse.json(toHostPerson(response));
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to fetch person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 },
    );
  }
}
