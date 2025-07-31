import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';

export const getProposalVoters = ({
  proposalId,
  chain = 8453,
}: {
  proposalId: bigint;
  chain?: keyof typeof daoProposalsImplementationAddress;
}) => {
  const address = daoProposalsImplementationAddress[chain];

  return {
    address,
    abi: daoProposalsImplementationAbi,
    functionName: 'getProposalVoters',
    args: [proposalId],
  } as const;
};
