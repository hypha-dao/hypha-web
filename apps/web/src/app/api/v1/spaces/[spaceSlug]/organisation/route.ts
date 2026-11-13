import {
  findSpaceBySlug,
  getAllOrganizationSpacesForNodeById,
  Space,
} from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import { resolveMappedHostScope } from '../../../../../../lib/white-label/mapped-host-scope';
import { keepPublicSpaces } from '../../../../../../lib/white-label/public-spaces';

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ spaceSlug: string }>;
  },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    // Mapped host (Space header set by middleware): the tree is filtered to the
    // host's own Space and PUBLIC Spaces. No header means the main app, which
    // continues below unchanged (interim, see #2652).
    const scope = await resolveMappedHostScope(request, { db });
    if (scope.kind === 'unknown-space') {
      return new NextResponse(null, { status: 404 });
    }
    if (scope.kind === 'mapped' && scope.spaceId !== space.id) {
      return new NextResponse(null, { status: 404 });
    }

    const spaces: Space[] = await getAllOrganizationSpacesForNodeById({
      id: space.id,
    });

    if (scope.kind === 'mapped') {
      return NextResponse.json(
        await keepPublicSpaces(spaces, scope.web3SpaceId),
      );
    }

    return NextResponse.json(spaces);
  } catch (err: any) {
    const error = err instanceof Error ? err : new Error(String(err));
    return NextResponse.json(
      {
        error: 'Failed to get spaces',
        message: error.message,
      },
      {
        status: 500,
      },
    );
  }
}
