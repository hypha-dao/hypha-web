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

type AssetsPayload = {
  assets: AssetItem[];
  balance: number;
  /**
   * Upstream sources that failed while assembling this response. When Alchemy
   * is listed the payload looks like an "energy-only" wallet and must not
   * replace a previously complete fetch in the client cache.
   */
  incompleteSources?: string[];
};

type UseAssetsReturn = {
  assets: AssetItem[];
  isLoading: boolean;
  balance: number;
  manualUpdate: () => Promise<void>;
};

function isCompletePayload(payload: AssetsPayload): boolean {
  return !payload.incompleteSources || payload.incompleteSources.length === 0;
}

/**
 * Survives remounts and JWT-key churn so an Alchemy blip after a good fetch
 * cannot replace the full wallet with the energy-catalogue subset.
 */
const completeWalletBySlug = new Map<string, AssetsPayload>();

export const useUserAssets = ({
  filter,
  // 30s: the assets route hits Alchemy + several RPCs; polling every 10s was
  // frequent enough to surface transient upstream gaps as balance flicker.
  refreshInterval = 30000,
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

  // The JWT resolves before the slug does, so keying on it alone fired a
  // request for `/people/undefined/assets` on every mount.
  const { data, isLoading, mutate } = useSWR(
    jwt && personSlug ? [endpoint, jwt] : null,
    async ([endpoint, jwt]) => {
      const res = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch user assets: ${res.statusText}`);
      }
      const payload = (await res.json()) as AssetsPayload;
      if (
        !Array.isArray(payload.assets) ||
        typeof payload.balance !== 'number'
      ) {
        throw new Error('Failed to fetch user assets: invalid payload');
      }

      const slug = personSlug as string;
      if (isCompletePayload(payload)) {
        completeWalletBySlug.set(slug, payload);
        return payload;
      }

      // Alchemy (etc.) failed: this payload is the energy/member catalogue
      // subset. Prefer the last complete wallet for this slug so the balance
      // does not collapse mid-session. First paint with no prior complete
      // fetch still shows the partial set rather than an empty grid.
      const previousComplete = completeWalletBySlug.get(slug);
      if (previousComplete) {
        console.warn(
          `Incomplete assets response (${(payload.incompleteSources ?? []).join(
            ', ',
          )}); keeping previous wallet`,
        );
        return previousComplete;
      }
      return payload;
    },
    {
      refreshInterval,
      // Keep the last good wallet when the JWT (and therefore the SWR key)
      // rotates, or when a refresh fails — otherwise the balance drops to 0
      // and the token grid empties for a few seconds every poll/refresh.
      keepPreviousData: true,
      revalidateOnFocus: true,
      errorRetryCount: 3,
    },
  );

  const typedData = data as AssetsPayload | undefined;
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
    // A null SWR key reports "not loading", which would flash an empty wallet
    // in the gap between the JWT arriving and the slug being known.
    // Once we have data, background revalidation must not look like a first load.
    isLoading:
      (!hasValidData && isLoading) ||
      (Boolean(jwt) && !personSlug && !hasValidData),
    balance: hasValidData ? typedData.balance : 0,
    manualUpdate: mutate,
  };
};
