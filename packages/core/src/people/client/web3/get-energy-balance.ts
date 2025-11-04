import {
  energyDistributionImplementationAbi,
  energyDistributionImplementationAddress,
} from '@hypha-platform/core/generated';

export const getEnergyBalances = ({
  member,
  chain = 8453,
}: {
  member: `0x${string}`;
  chain?: keyof typeof energyDistributionImplementationAddress;
}) => {
  const address = energyDistributionImplementationAddress[chain];

  return {
    address,
    abi: energyDistributionImplementationAbi,
    functionName: 'getCashCreditBalance',
    args: [member],
  } as const;
};
