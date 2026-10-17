import { NextRequest } from 'next/server';
import { getOrder } from '@hypha-platform/core/client';
import { buildDocumentsListV2 } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import {
  authenticateV2,
  failureResponse,
  jsonV2,
  v2Route,
} from '../../../../../../lib/api-v2/authenticate-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * twin:         GET /api/v1/spaces/[spaceSlug]/documents
 * kind:         enriched
 * adds:         per-item `status` (onVoting | accepted | rejected | withdrawn;
 *               absent only when the document has no `web3ProposalId`;
 *               `withdrawn` wins over `rejected`; no "expired": `rejected`
 *               covers vote rejection and timeout); `?include=tally` adds a
 *               per-item `tally` block {startTime, endTime, executed, expired,
 *               yesVotes, noVotes, totalVotingPowerAtSnapshot, quorum, unity,
 *               awaitingDecision} (no `transactions[]`; `null` when that
 *               proposal's read failed). `expired` means "closed unaccepted",
 *               not "timed out". `asOf`, `asOfBlock`. Unknown include -> 400.
 * diverges:     omits `creator.address` (creator is rebuilt from the public
 *               allowlist: avatarUrl, name, surname, type); requires the client key; v2 access gate (see v2 space route)
 *               instead of v1's bare-token gate; `pageSize` default 20, cap
 *               100 (v1: default 10, no cap); chain reads at `latest` with
 *               `asOf` (the shared server helper reads `safe`, which lags);
 *               502 when proposal outcomes cannot be read (v1 has no chain
 *               read here); `state`, `searchTerm`, `order` as v1.
 * ui-delegated: status labels and badges; "Voting closed" wording for
 *               onVoting + awaitingDecision; polling and refresh-after-vote;
 *               the detail banner's stale-read guard.
 */
async function handleGet(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const auth = await authenticateV2(request);
  if (!auth.ok) return auth.response;

  const { spaceSlug } = await params;

  try {
    const url = request.nextUrl.searchParams;
    const page = Number.parseInt(url.get('page') || '1', 10);
    const pageSize = Number.parseInt(url.get('pageSize') || '', 10);
    const orderString = url.get('order') || undefined;

    const result = await buildDocumentsListV2(
      {
        spaceSlug,
        page: Number.isNaN(page) ? 1 : page,
        pageSize: Number.isNaN(pageSize) ? undefined : pageSize,
        state: url.get('state'),
        searchTerm: url.get('searchTerm') || undefined,
        // @ts-ignore: TODO: order type (same as the v1 route)
        order: getOrder(orderString),
        include: url.get('include'),
      },
      auth.caller,
      { db },
    );
    if (!result.ok) return failureResponse(result);

    return jsonV2(result.body);
  } catch (error) {
    console.error('Failed to fetch documents (v2):', error);
    return jsonV2({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export const GET = v2Route(handleGet);
