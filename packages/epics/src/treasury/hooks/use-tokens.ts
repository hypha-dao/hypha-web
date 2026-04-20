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

const isEvmAddressParam = (value?: string): value is `0x${string}` =>
  typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/i.test(value);

/**
 * ERC-20 tokens with positive balance for a wallet. Excludes tokens explicitly
 * marked non-transferable in DB (`transferable === false`). Used for exchange
 * legs (catalogue-independent where applicable).
 */
export function useWalletTransferableTokens({
  spaceSlug,
  walletAddress,
}: {
  spaceSlug: string;
  walletAddress?: string;
}) {
  const { getAccessToken } = useAuthentication();

  const endpoint = React.useMemo(() => {
    if (!isEvmAddressParam(walletAddress)) return null;
    const q = new URLSearchParams({ address: walletAddress });
    return `/api/v1/spaces/${spaceSlug}/wallet-transferable-tokens?${q.toString()}`;
  }, [spaceSlug, walletAddress]);

  const { data, isLoading, mutate } = useSWR(
    endpoint ? [endpoint] : null,
    async ([url]: [string]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(url, { headers });
      if (!res.ok) {
        throw new Error(`Failed to fetch wallet tokens: ${res.status}`);
      }
      return res.json();
    },
  );

  const tokens = React.useMemo(() => {
    if (!data?.assets) return [];
    return (data.assets as ExtendedToken[])
      .filter((asset) => asset.transferable !== false)
      .map((asset) => ({
        address: asset.address,
        icon: asset.icon,
        name: asset.name,
        type: asset.type,
        symbol: asset.symbol,
        space: asset.space,
      }));
  }, [data]);

  return {
    tokens,
    isLoading: Boolean(endpoint) && isLoading,
    revalidateTokens: mutate,
  };
}
