'use client';

import React from 'react';
import useSWR from 'swr';
import { useJwt } from '@hypha-platform/core/client';

type OneChartPoint = {
  month: string;
  value: number;
  date: string;
};

type TransactionCardProps = {
  id: string;
  title: string;
  description: string;
  amount: number;
  withUsdSymbol?: boolean;
  badges: {
    label: string;
    variant: 'solid' | 'soft' | 'outline' | 'surface';
  }[];
  author: {
    name: string;
    surname: string;
  };
  isLoading?: boolean;
  viewCount?: number;
  commentCount?: number;
};

/**
 * Canonical shape for an asset row served by `/api/v1/people/{slug}/assets`.
 *
 * Re-exported by `assets-list.tsx` so view components and hooks share a single
 * definition. New fields go here.
 */
export type AssetItem = {
  icon: string;
  name: string;
  symbol: string;
  value: number;
  tokenPrice?: number;
  referenceCurrency?: string | null;
  usdEqual: number;
  type: string;
  chartData: OneChartPoint[];
  transactions: TransactionCardProps[];
  closeUrl: string;
  slug: string;
  createdAt?: Date;
  supply?: {
    total: number;
    /**
     * Optional: the API producer (`/api/v1/people/[personSlug]/assets`) emits
     * `supply: { total }` only and does not currently include `max`. Mark
     * optional so consumers handle `undefined` instead of crashing on a stale
     * required-`number` contract.
     */
    max?: number;
  };
  space?: {
    title: string;
    slug: string;
  };
  address?: string;
  referencePrice?: number | null;
  /**
   * Mutual credit info — only present for RegularSpaceToken instances that have
   * mutual credit configured. `netBalance` is negative when the holder owes credit.
   */
  mutualCredit?: {
    defaultCreditLimit: number;
    creditBalance: number;
    netBalance: number;
    whitelistedSpaceIds: number[];
    /** Per-account effective limit (default + override). 0 when not eligible. */
    creditLimit: number;
    /** Remaining credit available for this account (0 when not eligible). */
    creditLimitLeft: number;
    /** True when the user is a member of any whitelisted space. */
    creditEligible: boolean;
  };
};

type UseAssetsReturn = {
  assets: AssetItem[];
  isLoading: boolean;
  balance: number;
  currency?: string;
  manualUpdate: () => Promise<void>;
};

export const useUserAssets = ({
  filter,
  refreshInterval = 10000,
  personSlug,
}: {
  filter?: { type: string };
  refreshInterval?: number;
  personSlug?: string;
}): UseAssetsReturn => {
  const { jwt } = useJwt();
  const endpoint = React.useMemo(() => {
    return `/api/v1/people/${personSlug}/assets`;
  }, [personSlug]);

  const { data, isLoading, mutate } = useSWR(
    jwt ? [endpoint, jwt] : null,
    ([endpoint, jwt]) =>
      fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      }).then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch user assets: ${res.statusText}`);
        }
        return await res.json();
      }),
    { refreshInterval },
  );

  const typedData = data as UseAssetsReturn | undefined;
  const hasValidData =
    typedData &&
    Array.isArray(typedData.assets) &&
    typeof typedData.balance === 'number';

  const filteredAssets = React.useMemo(() => {
    if (!hasValidData) return [];
    if (!filter || filter.type === 'all') return typedData.assets;
    return typedData.assets.filter((asset) => asset.type === filter.type);
  }, [hasValidData, typedData?.assets, filter]);

  return {
    assets: filteredAssets,
    isLoading,
    balance: hasValidData ? typedData.balance : 0,
    currency: typedData?.currency || 'USD',
    manualUpdate: mutate,
  };
};
