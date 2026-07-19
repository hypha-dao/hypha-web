import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  getSpaceOverviewSignals,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { spaceSlug: string };

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

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) {
        return response;
      }
    }

    const signals = await getSpaceOverviewSignals({ db }, space.id);

    return NextResponse.json({
      found: true,
      space_slug: spaceSlug,
      asOf: new Date().toISOString(),
      ...signals,
    });
  } catch (error) {
    console.error('Failed to fetch overview signals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch overview signals' },
      { status: 500 },
    );
  }
}
