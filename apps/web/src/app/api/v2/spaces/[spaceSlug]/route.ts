import { NextRequest } from 'next/server';
import { buildSpaceV2 } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authenticateV2,
  failureResponse,
  jsonV2,
  v2Route,
} from '../../../../../lib/api-v2/authenticate-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * twin:         GET /api/v1/spaces/[spaceSlug]
 * kind:         enriched
 * adds:         `?include=visibility,governance,counts` (blocks `visibility`
 *               {discoverability, access}; `governance` {quorum, unity,
 *               votingPowerSource, joinMethod, exitMethod}; `counts`
 *               {memberCount}; `null` = unknown, never a silent 0); `asOf`,
 *               `asOfBlock`. Unknown include -> 400.
 * diverges:     never carries `memberAddresses` (omitted by rule); requires the client key; applies the v2 access gate (PUBLIC
 *               access: guests; NETWORK: verified user; SPACE: on-chain
 *               member/delegate; ORGANISATION: also members of DB organisation
 *               siblings; no Postgres `memberships` fallback; fails closed on a
 *               chain read error) where v1 is open; unknown space is 404 (v1
 *               returns 200 `null`); blocks read at `latest`.
 * ui-delegated: i18n labels for the levels and methods; the empty/unknown
 *               rendering of `memberCount`.
 */
async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const auth = await authenticateV2(request);
  if (!auth.ok) return auth.response;

  const { spaceSlug } = await params;

  try {
    const result = await buildSpaceV2(
      {
        slug: spaceSlug,
        caller: auth.caller,
        include: request.nextUrl.searchParams.get('include'),
      },
      { db },
    );
    if (!result.ok) return failureResponse(result);

    return jsonV2(result.body);
  } catch (error) {
    console.error('Failed to fetch space (v2):', error);
    return jsonV2({ error: 'Failed to fetch space' }, { status: 500 });
  }
}

export const GET = v2Route(handleGet);
