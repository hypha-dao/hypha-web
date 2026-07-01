import { NextRequest, NextResponse } from 'next/server';
import {
  findCoherencesWithDueDatesInRange,
  findSpaceBySlug,
  normalizeCoherence,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  const url = new URL(request.url);
  const fromRaw = url.searchParams.get('from');
  const toRaw = url.searchParams.get('to');

  if (!fromRaw || !toRaw) {
    return NextResponse.json(
      { error: 'from and to query params are required' },
      { status: 400 },
    );
  }

  const from = new Date(fromRaw);
  const to = new Date(toRaw);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
  }

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
      if (!hasAccess && response) return response;
    }

    const rows = await findCoherencesWithDueDatesInRange(
      { db },
      { spaceId: space.id, from, to },
    );
    return NextResponse.json(rows.map(normalizeCoherence));
  } catch (error) {
    console.error('Failed to fetch signal deadlines:', error);
    return NextResponse.json(
      { error: 'Failed to fetch signal deadlines' },
      { status: 500 },
    );
  }
}
