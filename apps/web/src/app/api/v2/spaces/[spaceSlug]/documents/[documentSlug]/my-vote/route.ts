import { NextRequest, NextResponse } from 'next/server';
import { buildMyVoteV2 } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authenticateV2,
  failureResponse,
  jsonV2,
} from '../../../../../../../../lib/api-v2/authenticate-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * twin:         none
 * kind:         new
 * adds:         {hasVoted, vote (yes|no|null), isMember, isDelegate,
 *               votingPower (current `getVotingPower` view, decimal string) +
 *               votingPowerDecimals, votingPowerSource (1 token, 2 member,
 *               3 voice), canVote, reason, asOf, asOfBlock}. `canVote` is
 *               NECESSARY conditions only (open window, member or delegate,
 *               power > 0); the space subscription also matters on chain, so
 *               `true` is not a guarantee. Re-voting is allowed, so
 *               `hasVoted` does not block `canVote`. The recorded weight of
 *               an existing vote is not returned (events are not read).
 * diverges:     requires the client key AND a verified user token (401 for a
 *               guest) on any space, public or not; the document must belong
 *               to the space in the path (404 otherwise); `isDelegate` needs a
 *               member delegator, as the contract's `vote` does; chain reads
 *               at `latest`.
 * ui-delegated: wallet signing and submission; polling and refresh-after-
 *               vote; copy for each `reason`.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string; documentSlug: string }> },
) {
  const auth = await authenticateV2(request);
  if (!auth.ok) return auth.response;

  const { spaceSlug, documentSlug } = await params;

  try {
    const result = await buildMyVoteV2(
      { spaceSlug, documentSlug, caller: auth.caller },
      { db },
    );
    if (!result.ok) return failureResponse(result);

    return jsonV2(result.body);
  } catch (error) {
    console.error('Failed to fetch my-vote (v2):', error);
    return NextResponse.json(
      { error: 'Failed to fetch vote state' },
      { status: 500 },
    );
  }
}
