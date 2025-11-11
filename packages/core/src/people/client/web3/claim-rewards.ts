import {
  hyphaTokenAbi,
  hyphaTokenAddress,
} from '@hypha-platform/core/generated';
import { base } from 'viem/chains';

export type ClaimRewardsWeb3Input = {
  user: `0x${string}`;
};

export type ClaimRewardsWeb3Config = {
  chain?: keyof typeof hyphaTokenAddress;
};

export const claimRewards = (
  {
    user,
  }: {
    user: `0x${string}`;
  },
  { chain = base.id }: ClaimRewardsWeb3Config = {},
) => {
  const address = hyphaTokenAddress[chain];

  const callConfig = {
    address,
    abi: hyphaTokenAbi,
    functionName: 'claimRewards' as const,
    args: [user] as const,
  };
  return callConfig;
};
