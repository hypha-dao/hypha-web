import {
  votingPowerDelegationImplementationAbi,
  votingPowerDelegationImplementationAddress,
} from '@hypha-platform/core/generated';
import { base } from 'viem/chains';

export type DelegateWeb3Config = {
  chain?: keyof typeof votingPowerDelegationImplementationAddress;
};

export const delegate = (
  {
    memberAddress,
    spaceId,
  }: {
    memberAddress: `0x${string}`;
    spaceId: bigint;
  },
  { chain = base.id }: DelegateWeb3Config = {},
) => {
  const address = votingPowerDelegationImplementationAddress[chain];

  const callConfig = {
    address,
    abi: votingPowerDelegationImplementationAbi,
    functionName: 'delegate' as const,
    args: [memberAddress, spaceId] as const,
  };
  return callConfig;
};
