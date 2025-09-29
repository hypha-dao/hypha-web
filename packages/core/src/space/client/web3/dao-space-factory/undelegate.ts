import {
  votingPowerDelegationImplementationAbi,
  votingPowerDelegationImplementationAddress,
} from '@hypha-platform/core/generated';
import { base } from 'viem/chains';

export type UndelegateWeb3Config = {
  chain?: keyof typeof votingPowerDelegationImplementationAddress;
};

export const undelegate = (
  {
    spaceId,
  }: {
    spaceId: bigint;
  },
  { chain = base.id }: UndelegateWeb3Config = {},
) => {
  const address = votingPowerDelegationImplementationAddress[chain];

  const callConfig = {
    address,
    abi: votingPowerDelegationImplementationAbi,
    functionName: 'undelegate' as const,
    args: [spaceId] as const,
  };
  return callConfig;
};
