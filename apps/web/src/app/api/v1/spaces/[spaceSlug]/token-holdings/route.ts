import { NextRequest, NextResponse } from 'next/server';

import {
  findSpaceBySlug,
  getTokenHoldingsBySpaceSlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { spaceSlug: string };

function parseBooleanParam(
  url: URL,
  keys: string | string[],
  fallback: boolean,
): boolean {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const raw = url.searchParams.get(key);
    if (raw == null || raw === '') continue;
    const value = raw.toLowerCase();
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
  }
  return fallback;
}

function parseIntParam(
  url: URL,
  keys: string | string[],
  fallback?: number,
  max = 1000,
): number | undefined {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const raw = url.searchParams.get(key);
    if (raw == null || raw === '') continue;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 1) continue;
    return Math.min(parsed, max);
  }
  return fallback;
}

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

    let resolvedAuthToken: string | undefined;
    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const { hasAccess, response, authToken } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) {
        return response;
      }
      resolvedAuthToken = authToken;
    }

    const authHeader = request.headers.get('authorization');
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const bearer = bearerMatch?.[1]?.trim() || undefined;
    if (!resolvedAuthToken) {
      resolvedAuthToken = bearer;
    }

    const url = new URL(request.url);
    const includeZeroBalances = parseBooleanParam(
      url,
      ['includeZeroBalances', 'include_zero_balances'],
      false,
    );
    const includeTreasury = parseBooleanParam(
      url,
      ['includeTreasury', 'include_treasury'],
      true,
    );
    const holderLimit = parseIntParam(url, ['holderLimit', 'holder_limit']);

    const gated = await getTokenHoldingsBySpaceSlug(
      {
        spaceSlug,
        includeZeroBalances,
        includeTreasury,
        holderLimit,
      },
      { db, authToken: resolvedAuthToken },
    );

    if (gated.access === 'denied') {
      return NextResponse.json(
        { error: gated.message },
        { status: gated.httpStatus },
      );
    }

    if (!gated.result.found) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    return NextResponse.json(gated.result);
  } catch (error) {
    console.error('Failed to fetch token holdings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token holdings' },
      { status: 500 },
    );
  }
}
