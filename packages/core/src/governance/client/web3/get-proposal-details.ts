import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';

export const getProposalDetails = ({
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
    functionName: 'getProposalCore',
    args: [proposalId],
  } as const;
};
