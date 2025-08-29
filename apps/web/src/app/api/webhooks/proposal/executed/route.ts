import { Alchemy } from '@hypha-platform/core/server';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';

export const POST = Alchemy.newHandler(
  {
    signingKey: process.env.WH_PROPOSAL_EXECUTED_SIGN_KEY ?? '',
    abi: daoProposalsImplementationAbi,
    event: 'ProposalExecuted',
  },
  async () => {},
);
