import { documents } from '@hypha-platform/storage-postgres';
import { eq } from 'drizzle-orm';

import { buildMyVoteV2 } from '../../api-v2/server/documents';
import type { V2Caller } from '../../api-v2/server/access';
import { findPersonById } from '../../people/server/queries';
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
 * Check, with the existing v2 read logic, that the authenticated person may vote on the
 * proposal right now (member or delegate, open window, voting power) and
 * resolve the titles the approval page will show. Nothing here comes from the
 * client except the two slugs.
 */
export async function resolveVoteTarget(
  {
    personId,
    spaceSlug,
    proposalSlug,
  }: {
    personId: number;
    spaceSlug: string;
    proposalSlug: string;
  },
  { db }: DbConfig,
): Promise<VoteTargetResult> {
  // The person was authenticated by the route (Privy or authorization-server token): the same
  // person is loaded here, so this step does not depend on which kind of token was used.
  const person = await findPersonById({ id: personId }, { db });
  if (!person) {
    return { ok: false, status: 403, error: 'A Hypha profile is required' };
  }
  const caller: V2Caller = {
    kind: 'user',
    person,
    address: (person.address as `0x${string}` | null | undefined) ?? null,
  };

  const state = await buildMyVoteV2(
    { spaceSlug, documentSlug: proposalSlug, caller },
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
