import {
  Alchemy,
  deleteUndeployedTokensByAgreementWeb3Ids,
} from '@hypha-platform/core/server';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import { db } from '@hypha-platform/storage-postgres';
import { dispatch } from '@hypha-platform/notifications/server';
import type { ProposalRejectedEvent } from '@hypha-platform/notifications/server';

const proposalRejectedSigningKey = process.env.WH_PROPOSAL_REJECTED_SIGN_KEY;

function toSafeProposalId(proposalId: bigint): number | undefined {
  if (
    proposalId > BigInt(Number.MAX_SAFE_INTEGER) ||
    proposalId < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return undefined;
  }
  return Number(proposalId);
}

export const POST = proposalRejectedSigningKey
  ? Alchemy.newHandler(
      {
        signingKey: proposalRejectedSigningKey,
        abi: daoProposalsImplementationAbi,
        event: 'ProposalRejected',
      },
      async (events) => {
        const proposalIds = events
          .map(({ args }) => toSafeProposalId(args.proposalId))
          .filter(
            (proposalWeb3Id): proposalWeb3Id is number =>
              proposalWeb3Id !== undefined,
          );

        try {
          const deletedTokens = await deleteUndeployedTokensByAgreementWeb3Ids(
            proposalIds,
            { db },
          );
          if (deletedTokens.length > 0) {
            console.log(
              'Deleted undeployed draft tokens for rejected proposals:',
              deletedTokens.map((token) => ({
                id: token.id,
                agreementWeb3Id: token.agreementWeb3Id,
                name: token.name,
                symbol: token.symbol,
              })),
            );
          }
        } catch (error) {
          console.error(
            'Failed to delete undeployed draft tokens for rejected proposals:',
            error,
          );
          throw error;
        }

        const dispatching = proposalIds.map((proposalWeb3Id) => {
          const event: ProposalRejectedEvent = {
            type: 'proposal.rejected',
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
            console.error('Failed to notify about proposal rejection:', reason),
          );
      },
    )
  : async () => {
      console.error('Missing key for proposal rejected webhook');

      return Response.json(
        { error: 'Webhook signing key is not configured.' },
        { status: 500 },
      );
    };
