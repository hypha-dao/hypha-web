'use client';

import { useCallback } from 'react';
import {
  publicClient,
  getPendingRewards,
  claimRewards,
} from '@hypha-platform/core/client';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import useSWRMutation from 'swr/mutation';

export type UsePendingRewardsInput = {
  user?: `0x${string}`;
  /** Optional: space-specific HyphaToken address (as in claim-rewards.ts script) */
  hyphaTokenAddress?: `0x${string}`;
};

export const usePendingRewards = ({
  user,
  hyphaTokenAddress,
}: UsePendingRewardsInput = {}) => {
  const { client } = useSmartWallets();
  const waitForClaimReceipt = useCallback(async (hash: `0x${string}`) => {
    return publicClient.waitForTransactionReceipt({ hash });
  }, []);

  const { data, isLoading, error, mutate } = useSWR(
    user ? [user, hyphaTokenAddress ?? 'default', 'rewards'] : null,
    async ([user]) =>
      publicClient.readContract(
        getPendingRewards({ user: user as `0x${string}`, hyphaTokenAddress }),
      ),
    { revalidateOnFocus: true },
  );

  const { trigger: claimRewardsMutation, isMutating: isClaiming } =
    useSWRMutation(
      client && user
        ? [user, hyphaTokenAddress ?? 'default', 'claimRewardsWeb3']
        : null,
      async ([user]) => {
        if (!client) throw new Error('Smart wallet client not available');
        return await client?.writeContract(
          claimRewards({
            user: user as `0x${string}`,
            hyphaTokenAddress,
          }),
        );
      },
    );

  return {
    updatePendingRewards: mutate,
    claim: claimRewardsMutation,
    waitForClaimReceipt,
    isClaiming,
    pendingRewards: data,
    isLoading,
    error,
  };
};
