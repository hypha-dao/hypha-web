'use client';

import useSWR from 'swr';
import { getTokenDecimals } from '../../../client';

export const useTokenDecimals = (tokenAddress?: string) => {
  const { data, error, isLoading } = useSWR(
    tokenAddress ? [tokenAddress as `0x${string}`, 'getTokenDecimals'] : null,
    async ([tokenAddress]) => {
      const count = await getTokenDecimals(tokenAddress);
      return count;
    },
  );
  return { decimals: data, error, isLoading };
};
