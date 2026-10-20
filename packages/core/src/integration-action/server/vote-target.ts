import { documents } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';

import { buildMyVoteV2 } from '../../api-v2/server/documents';
import { resolveV2Caller } from '../../api-v2/server/access';
import { findSpaceHostFieldsBySlug } from '../../space/server/queries';
import type { DbConfig } from '../../server';
import type { VoteActionContext } from '../types';

export type VoteTargetResult =
  | { ok: true; context: VoteActionContext }
  | {
      ok: false;
      status: 401 | 403 | 404 | 409 | 500 | 502;
      error: string;
      code?: string;
      reason?: string;
    };

/**
 * Check, with the existing v2 read logic, that the token user may vote on the
 * proposal right now (member or delegate, open window, voting power) and
 * resolve the titles the approval page will show. Nothing here comes from the
 * client except the two slugs.
 */
export async function resolveVoteTarget(
  {
    authorization,
    spaceSlug,
    proposalSlug,
  }: {
    authorization: string | null;
    spaceSlug: string;
    proposalSlug: string;
  },
  { db }: DbConfig,
): Promise<VoteTargetResult> {
  const caller = await resolveV2Caller(authorization, { db });
  if (!caller.ok) {
    return {
      ok: false,
      status: caller.status === 403 ? 403 : 401,
      error: caller.error,
    };
  }

  const state = await buildMyVoteV2(
    { spaceSlug, documentSlug: proposalSlug, caller: caller.caller },
    { db },
  );
  if (!state.ok) {
    return {
      ok: false,
      status: state.status as 401 | 403 | 404 | 500 | 502,
      error: state.error,
    };
  }
  if (!state.body.canVote) {
    return {
      ok: false,
      status: 409,
      error: 'This person cannot vote on this proposal right now',
      code: 'cannot_vote',
      reason: state.body.reason,
    };
  }

  // buildMyVoteV2 already proved the space exists and owns the document.
  const space = await findSpaceHostFieldsBySlug({ slug: spaceSlug }, { db });
  const [doc] = await db
    .select({
      title: documents.title,
      web3ProposalId: documents.web3ProposalId,
    })
    .from(documents)
    .where(eq(documents.slug, proposalSlug))
    .limit(1);
  if (!space || !doc || doc.web3ProposalId == null) {
    return { ok: false, status: 404, error: 'Document not found' };
  }

  return {
    ok: true,
    context: {
      spaceTitle: space.title ?? spaceSlug,
      proposalTitle: doc.title ?? proposalSlug,
      web3ProposalId: Number(doc.web3ProposalId),
    },
  };
}
