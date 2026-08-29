'use client';

import {
  TOKENS,
  Token,
  TokenType,
  validTokenTypes,
} from '@hypha-platform/core/client';
import useSWR from 'swr';
import React from 'react';
import { useAuthentication } from '@hypha-platform/authentication';

export interface ExtendedToken extends Omit<Token, 'type'> {
  type: TokenType | null;
  space?: {
    title: string;
    slug: string;
  };
}

function toPickerTokenType(type: Token['type']): TokenType | null {
  if (type != null && (validTokenTypes as readonly string[]).includes(type)) {
    return type as TokenType;
  }
  return null;
}

function toExtendedToken(
  asset: Token & { space?: ExtendedToken['space'] },
): ExtendedToken {
  return {
    ...asset,
    type: toPickerTokenType(asset.type),
    space: asset.space,
  };
}

const PICKER_PAGE_SIZE = 500;
const PICKER_MAX_PAGES = 20;

type AssetsWithoutBalancesPage = {
  data?: ExtendedToken[];
  assets?: ExtendedToken[];
  pagination?: { hasNextPage?: boolean };
};

/** Read one picker page and whether more pages remain. */
export function readAssetsWithoutBalancesPage(
  payload: AssetsWithoutBalancesPage | null | undefined,
): { items: ExtendedToken[]; hasNextPage: boolean } {
  const list = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.assets)
    ? payload.assets
    : [];
  return {
    items: list,
    hasNextPage: payload?.pagination?.hasNextPage === true,
  };
}

/**
 * Space token catalogue for proposal pickers. Follows
 * `/assets-without-balances` pagination until every page is loaded.
 */
export function useTokens({ spaceSlug }: { spaceSlug: string }) {
  const { getAccessToken } = useAuthentication();

  const { data, isLoading, mutate } = useSWR(
    spaceSlug ? [spaceSlug, 'assets-without-balances'] : null,
    async ([slug]: [string]) => {
      const token = await getAccessToken();
      const headers: HeadersInit = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const collected: ExtendedToken[] = [];
      let page = 1;
      let hasNextPage = true;
      while (hasNextPage) {
        if (page > PICKER_MAX_PAGES) {
          throw new Error(
            `Token picker exceeded ${PICKER_MAX_PAGES} pages of ${PICKER_PAGE_SIZE} tokens.`,
          );
        }
        const endpoint = `/api/v1/spaces/${slug}/assets-without-balances?page=${page}&pageSize=${PICKER_PAGE_SIZE}`;
        const response = await fetch(endpoint, { headers });
        if (!response.ok) {
          throw new Error(
            `Failed to fetch assets without balances: ${response.status}`,
          );
        }
        const payload = (await response.json()) as AssetsWithoutBalancesPage;
        const { items, hasNextPage: more } =
          readAssetsWithoutBalancesPage(payload);
        collected.push(...items);
        hasNextPage = more;
        page += 1;
      }
      return collected;
    },
  );

  const tokens = React.useMemo((): ExtendedToken[] => {
    return (data ?? TOKENS).map(toExtendedToken);
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
      .map(toExtendedToken);
  }, [data]);

  return {
    tokens,
    isLoading: Boolean(endpoint) && isLoading,
    revalidateTokens: mutate,
  };
}
