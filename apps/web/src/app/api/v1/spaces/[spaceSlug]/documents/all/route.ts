import { NextRequest, NextResponse } from 'next/server';
import { appendFileSync } from 'node:fs';

import {
  findAllDocumentsBySpaceSlugWithoutPagination,
  findSpaceBySlug,
} from '@hypha-platform/core/server';
import { getOrder } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

type Params = { spaceSlug: string };

const appendDebugLog = (
  hypothesisId: string,
  location: string,
  message: string,
  data: Record<string, unknown>,
) => {
  appendFileSync(
    '/opt/cursor/logs/debug.log',
    JSON.stringify({
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }) + '\n',
  );
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  const url = new URL(request.url);
  const orderString = url.searchParams.get('order') || undefined;
  // #region agent log
  appendDebugLog(
    'D',
    'spaces/[spaceSlug]/documents/all/route.ts:37',
    'GET entry',
    {
      spaceSlug,
      orderString: orderString ?? null,
    },
  );
  // #endregion

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId) {
      const { hasAccess, response } = await checkSpaceAccess(
        request,
        space.web3SpaceId as number,
      );

      if (!hasAccess && response) {
        return response;
      }
    }

    const order = getOrder(orderString);

    const documents = await findAllDocumentsBySpaceSlugWithoutPagination(
      {
        spaceSlug,
        order,
      },
      { db },
    );
    // #region agent log
    appendDebugLog(
      'D',
      'spaces/[spaceSlug]/documents/all/route.ts:73',
      'GET success',
      {
        hasSpace: Boolean(space),
        web3SpaceId: space?.web3SpaceId ?? null,
        documentsCount: documents.length,
      },
    );
    // #endregion

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Failed to fetch space documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch space documents' },
      { status: 500 },
    );
  }
}
