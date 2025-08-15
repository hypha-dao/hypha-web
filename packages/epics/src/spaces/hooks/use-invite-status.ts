'use client';

import useSWR from 'swr';
import { publicClient } from '@hypha-platform/core/client';
import { getInviteInfo } from '@hypha-platform/core/client';

export const useInviteStatus = ({
  spaceId,
  address,
}: {
  spaceId: bigint;
  address?: `0x${string}`;
}) => {
  const {
    data: inviteInfo,
    isLoading: isInviteLoading,
    error: inviteError,
    mutate: revalidateInviteStatus,
  } = useSWR(
    address ? [address, spaceId, 'inviteInfo'] : null,
    async ([address, spaceId]) => {
      const config = getInviteInfo({
        address: address as `0x${string}`,
        spaceId: spaceId as bigint,
      });
      try {
        const result = (await publicClient.readContract(config)) as readonly [
          bigint,
          boolean,
        ];
        return {
          lastInviteTime: Number(result[0]),
          hasActiveProposal: result[1],
        };
      } catch (error) {
        console.error('Failed to fetch invite info:', error);
        throw error;
      }
    },
  );

  return {
    lastInviteTime: inviteInfo?.lastInviteTime,
    hasActiveProposal: inviteInfo?.hasActiveProposal,
    isInviteLoading,
    revalidateInviteStatus: revalidateInviteStatus,
    error: inviteError,
  };
};
