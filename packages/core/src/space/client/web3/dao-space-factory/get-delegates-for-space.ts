import {
  votingPowerDelegationImplementationAbi,
  votingPowerDelegationImplementationAddress,
} from '@hypha-platform/core/generated';

export const getDelegatesForSpace = ({
  spaceId,
  chain = 8453,
}: {
  spaceId: bigint;
  chain?: keyof typeof votingPowerDelegationImplementationAddress;
}) => {
  const address = votingPowerDelegationImplementationAddress[chain];

  return {
    address,
    abi: votingPowerDelegationImplementationAbi,
    functionName: 'getDelegatesForSpace',
    args: [spaceId],
  } as const;
};
