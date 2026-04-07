import {
  votingPowerDelegationImplementationAbi,
  votingPowerDelegationImplementationAddress,
} from '@hypha-platform/core/generated';

export const getDelegators = ({
  spaceId,
  user,
  chain = 8453,
}: {
  spaceId: bigint;
  user: `0x${string}`;
  chain?: keyof typeof votingPowerDelegationImplementationAddress;
}) => {
  const address = votingPowerDelegationImplementationAddress[chain];

  return {
    address,
    abi: votingPowerDelegationImplementationAbi,
    functionName: 'getDelegators',
    args: [user, spaceId],
  } as const;
};
