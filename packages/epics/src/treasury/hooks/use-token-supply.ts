'use client';
import React from 'react';

import useSWR from 'swr';

export function useTokenSupply(token: `0x${string}` | undefined | null) {
  const endpoint = React.useMemo(
    () =>
      token && token.startsWith('0x') ? `/api/v1/tokens/${token}/supply` : null,
    [token],
  );
  const { data, isLoading } = useSWR(
    endpoint ? [endpoint] : null,
    ([url]) => fetch(url).then((res) => res.json()),
    {
      revalidateOnFocus: true,
    },
  );

  return {
    supply: data?.supply,
    isLoading,
  };
}
