import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';

export const getSpaceMinProposalDuration = ({
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
    functionName: 'spaceMinProposalDuration',
    args: [spaceId],
  } as const;
};
