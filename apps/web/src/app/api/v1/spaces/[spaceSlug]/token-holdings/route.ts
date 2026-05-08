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

function parseFloatParam(
  url: URL,
  keys: string | string[],
  fallback?: number,
  min = 0,
  max = 100,
): number | undefined {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const raw = url.searchParams.get(key);
    if (raw == null || raw === '') continue;
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) continue;
    return Math.min(max, Math.max(min, parsed));
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

    if (space.web3SpaceId && canConvertToBigInt(space.web3SpaceId)) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );
      if (!hasAccess && response) {
        return response;
      }
    }

    const authHeader = request.headers.get('authorization');
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const bearer = bearerMatch?.[1]?.trim() || undefined;

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
    const collapseBelowPct = parseFloatParam(url, [
      'collapseBelowPct',
      'collapse_below_pct',
    ]);

    const gated = await getTokenHoldingsBySpaceSlug(
      {
        spaceSlug,
        includeZeroBalances,
        includeTreasury,
        holderLimit,
        collapseBelowPct,
      },
      { db, authToken: bearer },
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
