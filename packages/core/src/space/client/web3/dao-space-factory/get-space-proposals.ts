import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';

export const getSpaceProposals = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof daoProposalsImplementationAddress;
}) => {
  const address = daoProposalsImplementationAddress[chain];

  return {
    address,
    abi: daoProposalsImplementationAbi,
    functionName: 'getSpaceProposals',
    args: [spaceId],
  } as const;
};
