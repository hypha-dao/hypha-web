'use client';

import { publicClient } from '@core/common';
import { getSpaceDecayingTokens } from '../web3';
import useSWR from 'swr';

export const useSpaceHasVoiceToken = ({ spaceId }: { spaceId: bigint }) => {
  const { data, isLoading, error } = useSWR(
    [spaceId, 'decayingTokens'],
    async ([spaceId]) =>
      publicClient.readContract(getSpaceDecayingTokens({ spaceId })),
    { revalidateOnFocus: true },
  );
  const hasVoiceToken = data?.length !== 0;

  return {
    hasVoiceToken,
    isLoading,
    error,
  };
};
