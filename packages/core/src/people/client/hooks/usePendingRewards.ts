'use client';

import {
  publicClient,
  getPendingRewards,
  claimRewards,
} from '@hypha-platform/core/client';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import useSWRMutation from 'swr/mutation';

export const usePendingRewards = ({ user }: { user?: `0x${string}` }) => {
  const { client } = useSmartWallets();

  const { data, isLoading, error, mutate } = useSWR(
    user ? [user, 'rewards'] : null,
    async ([user]) => publicClient.readContract(getPendingRewards({ user })),
    { revalidateOnFocus: true },
  );

  const { trigger: claimRewardsMutation, isMutating: isClaiming } =
    useSWRMutation(
      client ? [user, 'claimRewardsWeb3'] : null,
      async ([user]) => {
        if (!client) throw new Error('Smart wallet client not available');
        return await client?.writeContract(
          claimRewards({ user: user as `0x${string}` }),
        );
      },
    );

  return {
    updatePendingRewards: mutate,
    claim: claimRewardsMutation,
    isClaiming,
    pendingRewards: data,
    isLoading,
    error,
  };
};
