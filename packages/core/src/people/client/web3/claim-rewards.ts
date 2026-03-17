import {
  hyphaTokenAbi,
  hyphaTokenAddress,
} from '@hypha-platform/core/generated';
import { base } from 'viem/chains';

export type ClaimRewardsWeb3Input = {
  user: `0x${string}`;
  /** Optional: space-specific HyphaToken address (as in claim-rewards.ts script) */
  hyphaTokenAddress?: `0x${string}`;
};

export type ClaimRewardsWeb3Config = {
  chain?: keyof typeof hyphaTokenAddress;
};

export const claimRewards = (
  { user, hyphaTokenAddress: customAddress }: ClaimRewardsWeb3Input,
  { chain = base.id }: ClaimRewardsWeb3Config = {},
) => {
  const address = customAddress ?? hyphaTokenAddress[chain];

  const callConfig = {
    address,
    abi: hyphaTokenAbi,
    functionName: 'claimRewards' as const,
    args: [user] as const,
  };
  return callConfig;
};
