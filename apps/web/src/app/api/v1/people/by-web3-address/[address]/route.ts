import { NextRequest, NextResponse } from 'next/server';

import { findPersonByWeb3Address } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { resolveMappedHostScope } from '../../../../../../lib/white-label/mapped-host-scope';
import {
  isMemberOfMappedSpace,
  toHostPerson,
} from '../../../../../../lib/white-label/mapped-host-people';

type Params = { address: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { address } = await params;

  try {
    const person = await findPersonByWeb3Address({ address }, { db });

    // Mapped host (Space header set by middleware): a member of the host's own
    // Space only, without email or sub. No header means the main app, unchanged.
    const scope = await resolveMappedHostScope(request, { db });
    if (scope.kind !== 'main') {
      if (!person || !(await isMemberOfMappedSpace(scope, person.address))) {
        return NextResponse.json(
          { error: 'Person not found' },
          { status: 404 },
        );
      }
      return NextResponse.json(toHostPerson(person));
    }

    return NextResponse.json(person);
  } catch (error) {
    console.error('Failed to fetch person:', error);
    return NextResponse.json(
      { error: 'Failed to fetch person' },
      { status: 500 },
    );
  }
}
