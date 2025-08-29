import { Alchemy } from '@hypha-platform/core/server';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';

export const POST = Alchemy.newHandler(
  {
    signingKey: process.env.WH_PROPOSAL_REJECTED_SIGN_KEY ?? '',
    abi: daoProposalsImplementationAbi,
    event: 'ProposalRejected',
  },
  async () => {},
);
