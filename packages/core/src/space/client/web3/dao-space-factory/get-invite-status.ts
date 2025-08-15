import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';

export const getInviteInfo = ({
  address,
  spaceId,
  chain = 8453,
}: {
  address: `0x${string}`;
  spaceId: bigint;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const spaceFactoryAddress = daoSpaceFactoryImplementationAddress[chain];
  return {
    address: spaceFactoryAddress,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'getInviteInfo' as const,
    args: [spaceId, address] as const,
  };
};
