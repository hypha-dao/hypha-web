import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';

export const getSpaceDetails = ({
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
    functionName: 'getSpaceDetails',
    args: [spaceId],
  } as const;
};
