import 'server-only';

import { web3Client } from '../../common/server/web3-rpc/client';
import {
  getProposalFromLogs,
  web3ProposalIdForDb,
} from '../client/web3/get-proposal-created-event';

/**
 * Read ProposalCreated from the issue-token tx using the server RPC client.
 * Uses the same RPC as cron/backfill (`RPC_URL`), avoiding mismatches with the
 * browser `NEXT_PUBLIC_RPC_URL` where receipts/logs can differ or be incomplete.
 */
export async function getIssueTokenWeb3ProposalIdFromTxHash(
  txHash: `0x${string}`,
): Promise<number> {
  const receipt = await web3Client.getTransactionReceipt({ hash: txHash });
  if (!receipt) {
    throw new Error(
      `No receipt for issue-token transaction yet: ${txHash}. Confirm the transaction on-chain and retry.`,
    );
  }
  const proposalArgs = getProposalFromLogs(receipt.logs);
  const rawProposalId = proposalArgs?.proposalId;
  const web3ProposalId = web3ProposalIdForDb(
    rawProposalId as bigint | undefined,
  );
  if (web3ProposalId == null) {
    throw new Error(
      'Could not read proposal id from chain for issue-token transaction (ProposalCreated not found in receipt logs)',
    );
  }
  return web3ProposalId;
}
