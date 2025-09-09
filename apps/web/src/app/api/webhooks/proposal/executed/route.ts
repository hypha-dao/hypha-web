import { Alchemy } from '@hypha-platform/core/server';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';

export const POST = Alchemy.newHandler(
  {
    signingKey: (() => {
      const key = process.env.WH_PROPOSAL_EXECUTED_SIGN_KEY;
      if (!key) throw new Error('Missing key for proposal executed webhook');

      return key;
    })(),
    abi: daoProposalsImplementationAbi,
    event: 'ProposalExecuted',
  },
  async () => {},
);
