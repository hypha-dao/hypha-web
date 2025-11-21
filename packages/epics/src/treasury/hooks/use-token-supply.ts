'use client';
import React from 'react';

import useSWR from 'swr';

export function useTokenSupply(token: `0x${string}` | undefined) {
  const endpoint = React.useMemo(
    () => `/api/v1/tokens/${token}/supply`,
    [token],
  );
  const { data, isLoading } = useSWR(
    [endpoint],
    ([endpoint]) => fetch(endpoint).then((res) => res.json()),
    {
      revalidateOnFocus: true,
    },
  );

  return {
    supply: data?.supply,
    isLoading,
  };
}
