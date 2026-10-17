import { NextRequest } from 'next/server';
import { buildMyMembershipV2 } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authenticateV2,
  failureResponse,
  jsonV2,
  v2Route,
} from '../../../../../../../lib/api-v2/authenticate-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * twin:         none
 * kind:         new
 * adds:         {isMember, isDelegate, asOf, asOfBlock}: the caller's own
 *               relationship to the space, read at `latest`. `isDelegate`
 *               means a listed delegate with at least one member delegator
 *               (the rule `vote` enforces); a delegate who is not a member is
 *               a valid state. No wallet addresses and no roster. Both flags
 *               are `null` (unknown, not false) when the space has no
 *               `web3SpaceId`.
 * diverges:     requires the client key AND a verified user token (401
 *               without or invalid); no content access gate: it answers about
 *               the caller, so a verified non-member of any space gets
 *               200 {isMember:false, isDelegate:false}, never 403/404. 404 is
 *               an unknown space only; 502 when the chain read fails.
 * ui-delegated: the Join / hide-Join decision and its copy.
 */
async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const auth = await authenticateV2(request);
  if (!auth.ok) return auth.response;

  const { spaceSlug } = await params;

  try {
    const result = await buildMyMembershipV2(
      { spaceSlug, caller: auth.caller },
      { db },
    );
    if (!result.ok) return failureResponse(result);

    return jsonV2(result.body);
  } catch (error) {
    console.error('Failed to fetch memberships/me (v2):', error);
    return jsonV2({ error: 'Failed to fetch membership' }, { status: 500 });
  }
}

export const GET = v2Route(handleGet);
