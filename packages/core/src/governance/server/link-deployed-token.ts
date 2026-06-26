import 'server-only';

import type { DatabaseInstance } from '../../common/server/types';
import { findTokenByAgreementWeb3Id } from './queries';
import { updateToken } from './mutations';
import { extractDeployedTokenFromReceipt } from './extract-deployed-token-from-receipt';

export type LinkDeployedTokenInput = {
  /** On-chain proposal id (matches `tokens.agreementWeb3Id`). */
  proposalId: number;
  /** Execution transaction hash from the `ProposalExecuted` event. */
  transactionHash?: `0x${string}` | null;
};

export type LinkDeployedTokenResult =
  | { status: 'linked'; address: `0x${string}` }
  | {
      status: 'skipped';
      reason:
        | 'no-db-token'
        | 'already-linked'
        | 'no-transaction-hash'
        | 'no-token-deployed-event';
      address?: string;
    };

/**
 * Deterministically backfills `tokens.address` for a deploy proposal once it
 * executes — the server-side replacement for the browser-only linking in
 * `useProposalEvents`. Safe to call for any executed proposal: it no-ops unless
 * a matching DB token exists with a still-empty address.
 */
export const linkDeployedTokenForProposal = async (
  { proposalId, transactionHash }: LinkDeployedTokenInput,
  { db }: { db: DatabaseInstance },
): Promise<LinkDeployedTokenResult> => {
  const token = await findTokenByAgreementWeb3Id(
    { agreementWeb3Id: proposalId },
    { db },
  );
  if (!token) {
    return { status: 'skipped', reason: 'no-db-token' };
  }
  if (token.address) {
    return {
      status: 'skipped',
      reason: 'already-linked',
      address: token.address,
    };
  }
  if (!transactionHash) {
    return { status: 'skipped', reason: 'no-transaction-hash' };
  }

  const deployed = await extractDeployedTokenFromReceipt(transactionHash);
  if (!deployed) {
    return { status: 'skipped', reason: 'no-token-deployed-event' };
  }

  await updateToken(
    { agreementWeb3Id: proposalId, address: deployed.tokenAddress },
    { db },
  );

  return { status: 'linked', address: deployed.tokenAddress };
};
