'use client';
import React from 'react';

import useSWR from 'swr';
import { fetchJson } from '@hypha-platform/core/client';

export function useTokenSupply(token: `0x${string}` | undefined | null) {
  const endpoint = React.useMemo(
    () =>
      token && token.startsWith('0x') ? `/api/v1/tokens/${token}/supply` : null,
    [token],
  );
  const { data, isLoading } = useSWR(
    endpoint ? [endpoint] : null,
    ([url]) => fetchJson(url, undefined, 'token supply'),
    {
      revalidateOnFocus: true,
    },
  );

  return {
    supply: data?.supply,
    isLoading,
  };
}
