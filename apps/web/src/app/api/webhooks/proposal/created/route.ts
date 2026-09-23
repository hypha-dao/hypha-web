import {
  Alchemy,
  decodeJoinRequestProposal,
} from '@hypha-platform/core/server';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';
import {
  buildProposalCreatedEvent,
  dispatch,
} from '@hypha-platform/notifications/server';

const proposalCreatedSigningKey = process.env.WH_PROPOSAL_CREATED_SIGN_KEY;

export const POST = proposalCreatedSigningKey
  ? Alchemy.newHandler(
      {
        signingKey: proposalCreatedSigningKey,
        abi: daoProposalsImplementationAbi,
        event: 'ProposalCreated',
      },
      async (events) => {
        const dispatching = events.map(({ args }) => {
          // Join requests are created on-chain by DAOSpaceFactory.joinSpace(),
          // so the event's `creator` is the factory contract — the actual
          // requester has to be recovered from the executionData.
          const joinRequesterAddress = decodeJoinRequestProposal({
            creator: args.creator,
            executionData: args.executionData,
          });

          const event = buildProposalCreatedEvent({
            proposalId: args.proposalId,
            spaceId: args.spaceId,
            creator: (joinRequesterAddress ?? args.creator) as `0x${string}`,
            proposalLabel: joinRequesterAddress !== null ? 'Invite' : undefined,
          });

          return dispatch(event);
        });

        (await Promise.allSettled(dispatching))
          .filter((res) => res.status === 'rejected')
          .forEach(({ reason }) =>
            console.error('Failed to notify about proposal creation:', reason),
          );
      },
    )
  : async () => {
      console.error('Missing key for proposal creation webhook');

      return Response.json(
        { error: 'Webhook signing key is not configured.' },
        { status: 500 },
      );
    };
