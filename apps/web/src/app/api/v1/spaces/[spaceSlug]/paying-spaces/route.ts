import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getPayingSpacesMetrics,
  isHyphaPlatformSpace,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { spaceSlug: string };

export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (!isHyphaPlatformSpace({ slug: space.slug, title: space.title })) {
      return NextResponse.json(
        {
          error:
            'Paying spaces are only available on the Hypha platform dashboard',
        },
        { status: 404 },
      );
    }

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const web3SpaceIdNum =
        typeof space.web3SpaceId === 'number'
          ? space.web3SpaceId
          : Number(space.web3SpaceId);
      if (!Number.isFinite(web3SpaceIdNum)) {
        return NextResponse.json(
          { error: 'Invalid web3 space id' },
          { status: 500 },
        );
      }
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        web3SpaceIdNum,
      );
      if (!hasAccess && response) {
        return response;
      }
    }

    const data = await getPayingSpacesMetrics({ db });
    return NextResponse.json({
      found: true,
      space_slug: space.slug,
      ...data,
    });
  } catch (error) {
    console.error('[paying-spaces] Failed to load dashboard', error);
    return NextResponse.json(
      { error: 'Failed to load paying spaces' },
      { status: 500 },
    );
  }
}
