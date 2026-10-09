import {
  daoSpaceFactoryImplementationAbi,
  daoSpaceFactoryImplementationAddress,
} from '@hypha-platform/core/generated';

/** On-chain member wallets for a space. Same factory list as `getMemberSpaces`. */
export const getSpaceMembers = ({
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
    functionName: 'getSpaceMembers',
    args: [spaceId],
  } as const;
};
