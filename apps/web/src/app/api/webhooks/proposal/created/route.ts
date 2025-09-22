import { Alchemy } from '@hypha-platform/core/server';
import { daoProposalsImplementationAbi } from '@hypha-platform/core/generated';

export const POST = Alchemy.newHandler(
  {
    signingKey: (() => {
      const key = process.env.WH_PROPOSAL_CREATED_SIGN_KEY;
      if (!key) throw new Error('Missing key for proposal creation webhook');

      return key;
    })(),
    abi: daoProposalsImplementationAbi,
    event: 'ProposalCreated',
  },
  async () => {},
);
