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

export function useTokens({
  spaceSlug,
  /** When false, return [] if the API has no assets (do not fall back to global TOKENS). */
  includeDefaultTokens = true,
}: {
  spaceSlug: string;
  includeDefaultTokens?: boolean;
}) {
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(
    () =>
      spaceSlug.trim() !== ''
        ? `/api/v1/spaces/${spaceSlug}/assets-without-balances`
        : null,
    [spaceSlug],
  );

  const { data, isLoading, mutate } = useSWR(
    endpoint ? [endpoint, includeDefaultTokens] : null,
    async ([url]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      return fetch(url as string, { headers }).then((res) => res.json());
    },
  );

  const tokens = React.useMemo(() => {
    if (!data?.assets) {
      return includeDefaultTokens ? TOKENS : [];
    }
    const formattedAssets = data.assets.map((asset: ExtendedToken) => ({
      address: asset.address,
      icon: asset.icon,
      name: asset.name,
      type: asset.type,
      symbol: asset.symbol,
      space: asset.space,
    }));
    return formattedAssets;
  }, [data, includeDefaultTokens]);

  return {
    tokens,
    isLoading,
    revalidateTokens: mutate,
  };
}
