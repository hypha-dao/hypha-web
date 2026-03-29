import { parseEventLogs } from 'viem';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';

/**
 * Extract the ProposalCreated event from transaction logs
 * @param logs - The transaction logs to parse
 * @returns The ProposalCreated event if found, undefined otherwise
 */
export const getProposalCreatedEvent = (logs: any[]) => {
  try {
    // Parse logs for the specific event
    const ProposalCreatedEvents = parseEventLogs({
      abi: daoProposalsImplementationAbi,
      logs,
      eventName: 'ProposalCreated',
    });

    if (ProposalCreatedEvents.length > 0) {
      return ProposalCreatedEvents[0];
    }
    return undefined;
  } catch (error) {
    console.error('Failed to parse ProposalCreated event:', error);
    return undefined;
  }
};

export const getProposalFromLogs = (logs: any[]) => {
  const event = getProposalCreatedEvent(logs);
  if (event) {
    return event.args;
  }
  return undefined;
};

/** Persist only when the on-chain id fits PostgreSQL integer / JS safe integer. */
export function web3ProposalIdForDb(
  proposalId: bigint | undefined,
): number | undefined {
  if (proposalId === undefined) return undefined;
  if (proposalId > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(
      'Proposal ID exceeds safe integer range and cannot be stored reliably',
    );
  }
  return Number(proposalId);
}
