import { NextRequest, NextResponse } from 'next/server';

import {
  findSpaceBySlug,
  getOrgMemoryBySpaceSlug,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import { canConvertToBigInt } from '@hypha-platform/ui-utils';

type Params = { spaceSlug: string };

function parseIntParam(
  url: URL,
  keys: string | string[],
  fallback: number,
  max: number,
): number {
  const keyList = Array.isArray(keys) ? keys : [keys];
  for (const key of keyList) {
    const raw = url.searchParams.get(key);
    if (raw == null || raw === '') continue;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) continue;
    return Math.min(max, n);
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

    const url = new URL(request.url);
    const authHeader = request.headers.get('authorization');
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i);
    const bearer = bearerMatch?.[1]?.trim() || undefined;

    const page = parseIntParam(url, 'page', 1, 100);
    const pageSize = parseIntParam(url, ['pageSize', 'page_size'], 20, 100);
    const assetsPage = parseIntParam(
      url,
      ['assetsPage', 'assets_page'],
      1,
      100,
    );
    const assetsPageSize = parseIntParam(
      url,
      ['assetsPageSize', 'assets_page_size'],
      50,
      100,
    );
    const searchTerm =
      url.searchParams.get('searchTerm') ||
      url.searchParams.get('search_term') ||
      undefined;
    const assetsSearch =
      url.searchParams.get('assetsSearch') ||
      url.searchParams.get('assets_search') ||
      undefined;

    const gated = await getOrgMemoryBySpaceSlug(
      {
        spaceSlug,
        page,
        pageSize,
        searchTerm,
        assetsPage,
        assetsPageSize,
        assetsSearch,
        requestUrlForSessionMatrix: request.url,
        assetView: 'full',
      },
      { db, authToken: bearer },
    );

    if (gated.access === 'denied') {
      return NextResponse.json({ error: gated.message }, { status: 403 });
    }

    return NextResponse.json(gated.result);
  } catch (error) {
    console.error('Failed to fetch org memory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch org memory' },
      { status: 500 },
    );
  }
}
