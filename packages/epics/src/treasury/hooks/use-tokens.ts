'use client';

import { TOKENS } from '@hypha-platform/core/client';
import useSWR from 'swr';
import React from 'react';

export function useTokens({ spaceSlug }: { spaceSlug: string }) {
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/assets-without-balances`,
    [spaceSlug],
  );

  const { data, isLoading } = useSWR([endpoint], ([endpoint]) =>
    fetch(endpoint).then((res) => res.json()),
  );

  const tokens = React.useMemo(() => {
    if (!data?.assets) return TOKENS;

    const formattedAssets = data.assets.map((asset: any) => ({
      address: asset.address,
      icon: '/placeholder/space-avatar-image.png',
      name: asset.name,
      status: '',
      symbol: asset.name,
    }));

    return TOKENS.concat(formattedAssets);
  }, [data]);

  return {
    tokens,
    isLoading,
  };
}
