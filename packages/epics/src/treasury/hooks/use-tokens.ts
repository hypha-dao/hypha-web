'use client';

import { TOKENS } from '@hypha-platform/core/client';
import useSWR from 'swr';
import React from 'react';
import { Token } from '@hypha-platform/core/client';

export interface ExtendedToken extends Token {
  space?: {
    title: string;
    slug: string;
  };
}

export function useTokens({ spaceSlug }: { spaceSlug: string }) {
  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/assets-without-balances`,
    [spaceSlug],
  );

  const { data, isLoading, mutate } = useSWR([endpoint], ([endpoint]) =>
    fetch(endpoint).then((res) => res.json()),
  );

  const tokens = React.useMemo(() => {
    if (!data?.assets) return TOKENS;
    const formattedAssets = data.assets.map((asset: ExtendedToken) => ({
      address: asset.address,
      icon: asset.icon,
      name: asset.name,
      type: asset.type,
      symbol: asset.symbol,
      space: asset.space,
    }));
    return formattedAssets;
  }, [data]);

  return {
    tokens,
    isLoading,
    revalidateTokens: mutate,
  };
}
