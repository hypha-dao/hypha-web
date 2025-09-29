import {
  votingPowerDelegationImplementationAbi,
  votingPowerDelegationImplementationAddress,
} from '@hypha-platform/core/generated';

export const getSpacesForDelegate = ({
  user,
  chain = 8453,
}: {
  user: `0x${string}`;
  chain?: keyof typeof votingPowerDelegationImplementationAddress;
}) => {
  const address = votingPowerDelegationImplementationAddress[chain];

  return {
    address,
    abi: votingPowerDelegationImplementationAbi,
    functionName: 'getSpacesForDelegate',
    args: [user],
  } as const;
};
