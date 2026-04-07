import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getSpaceMembersForHttpApi,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );

      if (!hasAccess && response) {
        return response;
      }
    }

    const url = new URL(request.url);
    const pageRaw = url.searchParams.get('page');
    const pageSizeRaw = url.searchParams.get('pageSize');
    const searchTerm = url.searchParams.get('searchTerm') || undefined;

    const page = pageRaw != null ? Number.parseInt(pageRaw, 10) : 1;
    const pageSize =
      pageSizeRaw != null ? Number.parseInt(pageSizeRaw, 10) : 10;

    const hasValidPagination =
      Number.isInteger(page) &&
      page > 0 &&
      Number.isInteger(pageSize) &&
      pageSize > 0;

    let roster;
    try {
      roster = await getSpaceMembersForHttpApi(
        {
          spaceSlug,
          page: hasValidPagination ? page : 1,
          pageSize: hasValidPagination ? pageSize : 10,
          searchTerm,
        },
        { db },
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : err &&
            typeof err === 'object' &&
            'shortMessage' in err &&
            typeof (err as { shortMessage?: unknown }).shortMessage === 'string'
          ? (err as { shortMessage: string }).shortMessage
          : String(err);
      if (msg.includes('rate limit') || msg.includes('429')) {
        console.warn('Rate limit exceeded when calling readContract:', msg);
        return NextResponse.json(
          {
            error: 'External API rate limit exceeded. Please try again later.',
          },
          { status: 503 },
        );
      }
      throw err;
    }

    if (!roster.found) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    return NextResponse.json({
      persons: roster.persons,
      spaces: roster.spaces,
    });
  } catch (error) {
    console.error('Failed to fetch members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch members.' },
      { status: 500 },
    );
  }
}
