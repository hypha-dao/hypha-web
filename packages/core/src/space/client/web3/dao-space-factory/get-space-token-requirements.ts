import {
  tokenBalanceJoinImplementationAbi,
  tokenBalanceJoinImplementationAddress,
} from '@hypha-platform/core/generated';

export const getSpaceTokenRequirements = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof tokenBalanceJoinImplementationAddress;
}) => {
  const address = tokenBalanceJoinImplementationAddress[chain];

  return {
    address,
    abi: tokenBalanceJoinImplementationAbi,
    functionName: 'spaceTokenRequirements',
    args: [spaceId],
  } as const;
};
