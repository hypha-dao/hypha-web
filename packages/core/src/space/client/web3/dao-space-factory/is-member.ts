import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@core/generated';

export const isMember = ({
  spaceId,
  memberAddress,
  chain = 8453,
}: {
  spaceId: bigint;
  memberAddress: `0x${string}`;
  chain?: keyof typeof daoSpaceFactoryImplementationAddress;
}) => {
  const address = daoSpaceFactoryImplementationAddress[chain];

  return {
    address,
    abi: daoSpaceFactoryImplementationAbi,
    functionName: 'isMember',
    args: [spaceId, memberAddress],
  } as const;
};
