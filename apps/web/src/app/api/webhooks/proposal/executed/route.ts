import {
  Alchemy,
  linkDeployedTokenForProposal,
} from '@hypha-platform/core/server';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import { dispatch } from '@hypha-platform/notifications/server';
import type { ProposalAcceptedEvent } from '@hypha-platform/notifications/server';

const proposalExecutedSigningKey = process.env.WH_PROPOSAL_EXECUTED_SIGN_KEY;

function toSafeProposalId(proposalId: bigint): number | undefined {
  if (
    proposalId > BigInt(Number.MAX_SAFE_INTEGER) ||
    proposalId < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return undefined;
  }
  return Number(proposalId);
}

export const POST = proposalExecutedSigningKey
  ? Alchemy.newHandler(
      {
        signingKey: proposalExecutedSigningKey,
        abi: daoProposalsImplementationAbi,
        event: 'ProposalExecuted',
      },
      async (events) => {
        const dispatching = events
          .map(({ args }) => toSafeProposalId(args.proposalId))
          .filter(
            (proposalWeb3Id): proposalWeb3Id is number =>
              proposalWeb3Id !== undefined,
          )
          .map((proposalWeb3Id) => {
            const event: ProposalAcceptedEvent = {
              type: 'proposal.accepted',
              source: {
                kind: 'domain',
                entityType: 'proposal',
                entityId: proposalWeb3Id.toString(),
              },
              context: { proposalWeb3Id },
            };
            return dispatch(event);
          });

        (await Promise.allSettled(dispatching))
          .filter((res) => res.status === 'rejected')
          .forEach(({ reason }) =>
            console.error('Failed to notify about proposal execution:', reason),
          );
      },
      async (events) => {
        // Server-side token-address backfill: deterministically links a
        // deployed token's address to its DB row when a deploy proposal
        // executes, independent of any browser being open. No-ops for
        // non-token proposals.
        const linking = events.map(async (event) => {
          const proposalId = toSafeProposalId(event.args.proposalId);
          if (proposalId === undefined) return;

          const result = await linkDeployedTokenForProposal(
            { proposalId, transactionHash: event.transactionHash },
            { db },
          );

          if (result.status === 'linked') {
            console.info(
              `Linked deployed token ${result.address} for proposal ${proposalId}.`,
            );
          }
        });

        (await Promise.allSettled(linking))
          .filter((res) => res.status === 'rejected')
          .forEach(({ reason }) =>
            console.error(
              'Failed to link deployed token for proposal:',
              reason,
            ),
          );
      },
    )
  : async () => {
      console.error('Missing key for proposal executed webhook');

      return Response.json(
        { error: 'Webhook signing key is not configured.' },
        { status: 500 },
      );
    };
