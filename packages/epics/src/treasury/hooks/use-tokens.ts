'use client';

import { TOKENS } from '@hypha-platform/core/client';
import useSWR from 'swr';
import React from 'react';
import { Token } from '@hypha-platform/core/client';
import { useAuthentication } from '@hypha-platform/authentication';

export interface ExtendedToken extends Token {
  space?: {
    title: string;
    slug: string;
  };
}

export function useTokens({ spaceSlug }: { spaceSlug: string }) {
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(
    () => `/api/v1/spaces/${spaceSlug}/assets-without-balances`,
    [spaceSlug],
  );

  const { data, isLoading, mutate } = useSWR([endpoint], async ([endpoint]) => {
    const token = await getAccessToken();
    const headers: HeadersInit = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(endpoint, { headers }).then((res) => res.json());
  });

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
