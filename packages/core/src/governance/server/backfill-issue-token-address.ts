import { web3Client } from '../../common/server/web3-rpc/client';
import type { DatabaseInstance } from '../../common/server/types';
import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '../../generated';
import { applyTokenUpdate, updateToken } from './mutations';
import { extractTokenAddressFromExecutionReceipt } from './extract-token-address-from-receipt';
import {
  findDocumentWithSpaceByIdRaw,
  findTokensMissingAddressWithWeb3ProposalId,
} from './queries';

function resolveGovernanceChainId(): keyof typeof daoProposalsImplementationAddress {
  const raw =
    process.env.NEXT_PUBLIC_GOVERNANCE_CHAIN_ID ??
    process.env.NEXT_PUBLIC_CHAIN_ID;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  if (Number.isSafeInteger(n) && n in daoProposalsImplementationAddress) {
    return n as keyof typeof daoProposalsImplementationAddress;
  }
  return 8453;
}

const proposalsAddress =
  daoProposalsImplementationAddress[resolveGovernanceChainId()];

function safeProposalIdFromBigInt(
  rawId: bigint,
): { ok: true; value: number } | { ok: false } {
  if (
    rawId > BigInt(Number.MAX_SAFE_INTEGER) ||
    rawId < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return { ok: false };
  }
  return { ok: true, value: Number(rawId) };
}

function proposalExecutedLogsFromBlock(): bigint {
  const raw = process.env.PROPOSALS_PROPOSAL_EXECUTED_FROM_BLOCK;
  if (raw == null || raw.trim() === '') {
    return 0n;
  }
  try {
    return BigInt(raw.trim());
  } catch {
    return 0n;
  }
}

export type BackfillIssueTokenAddressResult = {
  proposalId: number;
  status: 'updated' | 'skipped' | 'error';
  reason?: string;
  address?: string;
};

/**
 * Backfill `tokens.address` for issue-token proposals using the execution tx hash
 * from `ProposalExecuted` logs (same block as Alchemy webhook).
 */
export async function backfillIssueTokenAddressFromProposalExecutedLogs(
  events: ReadonlyArray<{
    transactionHash: `0x${string}`;
    args: {
      proposalId: bigint;
      passed: boolean;
    };
  }>,
  { db }: { db: DatabaseInstance },
): Promise<BackfillIssueTokenAddressResult[]> {
  const results: BackfillIssueTokenAddressResult[] = [];

  for (const ev of events) {
    const rawId = ev.args.proposalId;
    const parsed = safeProposalIdFromBigInt(rawId);
    if (!parsed.ok) {
      results.push({
        proposalId: -1,
        status: 'skipped',
        reason: 'proposal_id_out_of_range',
      });
      continue;
    }
    const proposalId = parsed.value;
    if (!ev.args.passed) {
      results.push({
        proposalId,
        status: 'skipped',
        reason: 'proposal_not_passed',
      });
      continue;
    }

    try {
      const r = await backfillIssueTokenAddressForExecutionTx(
        proposalId,
        ev.transactionHash,
        { db },
      );
      results.push(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        proposalId,
        status: 'error',
        reason: msg,
      });
    }
  }

  return results;
}

/**
 * Issue-token address backfill + pending `token_updates` apply when the client missed execution.
 */
export async function runProposalExecutedSideEffects(
  events: ReadonlyArray<{
    transactionHash: `0x${string}`;
    args: {
      proposalId: bigint;
      passed: boolean;
    };
  }>,
  { db }: { db: DatabaseInstance },
): Promise<void> {
  const backfillResults =
    await backfillIssueTokenAddressFromProposalExecutedLogs(events, { db });
  const backfillErrors = backfillResults.filter((r) => r.status === 'error');
  if (backfillErrors.length > 0) {
    console.warn(
      '[proposal-executed] backfillIssueTokenAddress errors:',
      backfillErrors,
    );
  }

  for (const ev of events) {
    if (!ev.args.passed) {
      continue;
    }
    const rawId = ev.args.proposalId;
    const parsed = safeProposalIdFromBigInt(rawId);
    if (!parsed.ok) {
      continue;
    }
    const proposalId = parsed.value;
    const doc = await findDocumentWithSpaceByIdRaw({ id: proposalId }, { db });
    if (!doc) {
      continue;
    }
    try {
      await applyTokenUpdate(doc.document.id, { db });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        /no token update found|not found/i.test(msg) === false &&
        /invalid token update json/i.test(msg) === false
      ) {
        console.error(
          '[proposal-executed] applyTokenUpdate failed:',
          proposalId,
          msg,
        );
      }
    }
  }
}

export async function backfillIssueTokenAddressForExecutionTx(
  proposalId: number,
  executionTxHash: `0x${string}`,
  { db }: { db: DatabaseInstance },
): Promise<BackfillIssueTokenAddressResult> {
  const tokenAddress = await extractTokenAddressFromExecutionReceipt(
    executionTxHash,
  );
  if (!tokenAddress) {
    return {
      proposalId,
      status: 'skipped',
      reason: 'no_token_deployed_event_in_receipt',
    };
  }

  try {
    await updateToken(
      {
        agreementWeb3Id: proposalId,
        address: tokenAddress,
      },
      { db },
    );
    return {
      proposalId,
      status: 'updated',
      address: tokenAddress,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/^No token found with/i.test(msg)) {
      return {
        proposalId,
        status: 'skipped',
        reason: 'no_db_token_row',
      };
    }
    throw e;
  }
}

/**
 * Retry backfill for DB rows that have `agreement_web3_id` but no `address`.
 * Finds the execution tx via `ProposalExecuted` logs, then extracts `TokenDeployed`.
 */
export async function backfillStaleIssueTokenAddresses({
  db,
  limit = 25,
}: {
  db: DatabaseInstance;
  limit?: number;
}): Promise<BackfillIssueTokenAddressResult[]> {
  const rows = await findTokensMissingAddressWithWeb3ProposalId(
    { limit },
    { db },
  );
  const results: BackfillIssueTokenAddressResult[] = [];

  for (const row of rows) {
    const proposalId =
      row.agreementWeb3Id ?? row.documentWeb3ProposalId ?? null;
    if (proposalId == null) {
      continue;
    }

    try {
      const txHash = await findLatestProposalExecutedTxHash(proposalId);
      if (!txHash) {
        results.push({
          proposalId,
          status: 'skipped',
          reason: 'proposal_executed_log_not_found',
        });
        continue;
      }
      const r = await backfillIssueTokenAddressForExecutionTx(
        proposalId,
        txHash,
        { db },
      );
      results.push(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({
        proposalId,
        status: 'error',
        reason: msg,
      });
    }
  }

  return results;
}

async function findLatestProposalExecutedTxHash(
  proposalId: number,
): Promise<`0x${string}` | undefined> {
  const logs = await web3Client.getContractEvents({
    address: proposalsAddress as `0x${string}`,
    abi: daoProposalsImplementationAbi,
    eventName: 'ProposalExecuted',
    args: {
      proposalId: BigInt(proposalId),
    },
    fromBlock: proposalExecutedLogsFromBlock(),
    toBlock: 'latest',
  });

  if (logs.length === 0) {
    return undefined;
  }

  const last = logs[logs.length - 1];
  return last?.transactionHash;
}
