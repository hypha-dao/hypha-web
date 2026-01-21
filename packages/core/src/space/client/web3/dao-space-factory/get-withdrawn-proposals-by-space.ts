import {
  daoProposalsImplementationAbi,
  daoProposalsImplementationAddress,
} from '@hypha-platform/core/generated';

export const getWithdrawnProposalsBySpace = ({
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
    functionName: 'getWithdrawnProposalsBySpace',
    args: [spaceId],
  } as const;
};
