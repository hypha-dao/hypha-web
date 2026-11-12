import { NextRequest, NextResponse } from 'next/server';
import {
  getSpacesByWeb3Ids,
  getAllSpaces,
  getSpacesBySlugs,
} from '@hypha-platform/core/server';
import { resolveMappedHostScope } from '../../../../lib/white-label/mapped-host-scope';

type Web3SpaceIds = number[] | undefined;
type Slugs = string[] | undefined;

/** True when the comma list is non-empty and every entry passes. */
function isOnly(
  list: string | null,
  accept: (token: string) => boolean,
): boolean {
  const tokens = (list ?? '').split(',').map((token) => token.trim());
  return tokens.length > 0 && tokens.every((token) => accept(token));
}

export async function GET(request: NextRequest) {
  try {
    const queryParams = request.nextUrl.searchParams;

    // Mapped host: only the host's own Space, named by id or slug. Anything
    // else (another Space, a list that includes one, no filter) is a 404.
    // No Space header means the main app, which continues below unchanged.
    const scope = await resolveMappedHostScope(request);
    if (scope.kind !== 'main') {
      const own =
        scope.kind === 'mapped' &&
        (queryParams.has('web3SpaceIds') || queryParams.has('slugs')) &&
        (!queryParams.has('web3SpaceIds') ||
          isOnly(
            queryParams.get('web3SpaceIds'),
            (token) =>
              scope.web3SpaceId !== null && token === String(scope.web3SpaceId),
          )) &&
        (!queryParams.has('slugs') ||
          isOnly(queryParams.get('slugs'), (token) => token === scope.slug));
      if (!own) return new NextResponse(null, { status: 404 });
    }

    const web3SpaceIds: Web3SpaceIds = queryParams.has('web3SpaceIds')
      ? (queryParams.get('web3SpaceIds')?.split(',') ?? [])
          .map(Number)
          .filter((id) => !Number.isNaN(id))
      : undefined;

    const slugs: Slugs = queryParams.has('slugs')
      ? (queryParams.get('slugs')?.split(',') ?? [])
          .map((slug) => slug.trim())
          .filter(Boolean)
      : undefined;

    const parentOnlyParam = queryParams.get('parentOnly');
    const parentOnly =
      parentOnlyParam !== null ? parentOnlyParam === 'true' : undefined;

    let spaces;

    if (web3SpaceIds) {
      const options = parentOnly !== undefined ? { parentOnly } : undefined;
      spaces = await getSpacesByWeb3Ids(web3SpaceIds, options);
    } else if (slugs) {
      const options = parentOnly !== undefined ? { parentOnly } : undefined;
      spaces = await getSpacesBySlugs(slugs, options);
    } else {
      spaces = await getAllSpaces({ parentOnly });
    }

    return NextResponse.json(spaces);
  } catch (error) {
    console.error('Failed to fetch spaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch spaces' },
      { status: 500 },
    );
  }
}
