import {
  hyphaTokenAbi,
  hyphaTokenAddress,
} from '@hypha-platform/core/generated';

export type GetPendingRewardsInput = {
  user: `0x${string}`;
  chain?: keyof typeof hyphaTokenAddress;
  /** Optional: space-specific HyphaToken address (as in claim-rewards.ts script) */
  hyphaTokenAddress?: `0x${string}`;
};

export const getPendingRewards = ({
  user,
  chain = 8453,
  hyphaTokenAddress: customAddress,
}: GetPendingRewardsInput) => {
  const address = customAddress ?? hyphaTokenAddress[chain];

  return {
    address,
    abi: hyphaTokenAbi,
    functionName: 'pendingRewards',
    args: [user],
  } as const;
};
