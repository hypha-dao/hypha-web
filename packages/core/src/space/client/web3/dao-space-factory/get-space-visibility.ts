import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';

export const getSpaceVisibility = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  return {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'getSpaceVisibility',
    args: [spaceId],
  } as const;
};
