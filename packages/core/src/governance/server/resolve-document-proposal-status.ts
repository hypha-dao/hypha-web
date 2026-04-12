import 'server-only';

import { web3Client } from '../../common/server/web3-rpc/client';
import { getSpaceProposals } from '../../space/client/web3/dao-space-factory/get-space-proposals';
import { getWithdrawnProposalsBySpace } from '../../space/client/web3/dao-space-factory/get-withdrawn-proposals-by-space';
import type { Document, DocumentStatus } from '../types';

export type ProposalOutcomeSets = {
  accepted: ReadonlySet<number>;
  rejected: ReadonlySet<number>;
  withdrawn: ReadonlySet<number>;
};

/**
 * Fetches accepted / rejected / withdrawn proposal id sets for a space (DAO proposals contract).
 * Returns `null` if the chain read fails (callers should omit `status` on documents).
 */
export async function fetchProposalOutcomeSetsForSpace(
  web3SpaceId: number,
): Promise<ProposalOutcomeSets | null> {
  const spaceId = BigInt(web3SpaceId);
  try {
    const [proposalsResult, withdrawnResult] = await web3Client.multicall({
      allowFailure: false,
      blockTag: 'safe',
      contracts: [
        getSpaceProposals({ spaceId }),
        getWithdrawnProposalsBySpace({ spaceId }),
      ],
    });

    const [acceptedRaw, rejectedRaw] = proposalsResult as readonly [
      readonly bigint[],
      readonly bigint[],
    ];
    const withdrawnRaw = withdrawnResult as readonly bigint[];

    const toNumSet = (ids: readonly bigint[]) =>
      new Set(ids.map((id) => Number(id)));

    return {
      accepted: toNumSet(acceptedRaw ?? []),
      rejected: toNumSet(rejectedRaw ?? []),
      withdrawn: toNumSet(withdrawnRaw ?? []),
    };
  } catch (err) {
    console.error('[fetchProposalOutcomeSetsForSpace] chain read failed', err);
    return null;
  }
}

/**
 * Mirrors `useSpaceDocumentsWithStatuses` in epics: `status` is derived from
 * on-chain proposal lists, not the `documents.state` enum.
 */
export function attachProposalStatusToDocument(
  doc: Document & { creator?: Document['creator'] },
  outcomes: ProposalOutcomeSets | null,
): Document & { creator?: Document['creator']; status?: DocumentStatus } {
  if (!outcomes || doc.web3ProposalId == null) {
    return doc;
  }

  const pid = Number(doc.web3ProposalId);
  if (outcomes.withdrawn.has(pid)) {
    return doc;
  }
  if (outcomes.accepted.has(pid)) {
    return { ...doc, status: 'accepted' };
  }
  if (outcomes.rejected.has(pid)) {
    return { ...doc, status: 'rejected' };
  }
  return { ...doc, status: 'onVoting' };
}
