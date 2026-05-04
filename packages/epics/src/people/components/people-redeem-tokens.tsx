'use client';

import React from 'react';
import {
  ProposalOverlayShell,
  ModalStickyNavigation,
  useUserAssets,
} from '@hypha-platform/epics';
import { PeopleRedeemForm } from './people-redeem-form';
import { Separator } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  publicClient,
  TokenType,
  useJwt,
  validTokenTypes,
} from '@hypha-platform/core/client';
import useSWR from 'swr';
import { erc20Abi } from 'viem';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  tokenPrice?: number;
  value?: number;
  type?: TokenType | null;
  space?: {
    title: string;
    slug: string;
    web3SpaceId?: number;
  };
}

interface ProfileRedeemTokensProps {
  lang: string;
  personSlug: string;
}

type SpaceSummary = {
  slug: string;
  title: string;
  web3SpaceId?: number | null;
};

type SpaceVaultsResponse = {
  web3SpaceId?: number;
  vaults?: Array<{
    spaceToken: string;
    tokenSymbol?: string;
    tokenIcon?: string;
    redemptionPrice?: number;
    redemptionEnabled?: boolean;
    redemptionStartDate?: string | Date;
    tokenName?: string;
  }>;
};

type VaultFetchDiagnostic = {
  spaceSlug: string;
  status: number;
};

type RedeemDiscoveryDiagnostics = {
  vaultFetch: VaultFetchDiagnostic[];
  checkedVaultTokenCount: number;
  balanceReadFailureCount: number;
};

export const ProfileRedeemTokens = ({
  lang,
  personSlug,
}: ProfileRedeemTokensProps) => {
  const tRedeem = useTranslations('ProfileActions.redeemTokens');
  const tActions = useTranslations('ProfileActions');
  const tModalAside = useTranslations('ModalAside');
  const { assets: userAssets, manualUpdate } = useUserAssets({
    personSlug,
    refreshInterval: 10000,
  });
  const { jwt } = useJwt();
  const {
    data: personData,
    error: personError,
    isLoading: personLoading,
  } = useSWR<{ address?: string }>(
    `/api/v1/people/${personSlug}`,
    async (url: string) => {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load person: ${res.statusText}`);
      }
      return (await res.json()) as { address?: string };
    },
  );

  const {
    data: spaces,
    error: spacesError,
    isLoading: spacesLoading,
  } = useSWR<SpaceSummary[]>(
    jwt ? ['people-spaces', personSlug, jwt] : null,
    async ([, slug, token]) => {
      const res = await fetch(`/api/v1/people/${slug}/spaces`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load spaces: ${res.statusText}`);
      }
      return (await res.json()) as SpaceSummary[];
    },
  );

  const inferredSpacesFromAssets = React.useMemo(() => {
    const spacesBySlug = new Map<string, SpaceSummary>();
    for (const asset of userAssets) {
      if (!asset.space?.slug) continue;
      spacesBySlug.set(asset.space.slug, {
        slug: asset.space.slug,
        title: asset.space.title ?? asset.space.slug,
      });
    }
    return Array.from(spacesBySlug.values());
  }, [userAssets]);

  const uniqueSpaces = React.useMemo(() => {
    const spacesBySlug = new Map<string, SpaceSummary>();
    for (const space of spaces ?? []) {
      if (!space.slug) continue;
      spacesBySlug.set(space.slug, space);
    }
    for (const space of inferredSpacesFromAssets) {
      const existing = spacesBySlug.get(space.slug);
      spacesBySlug.set(
        space.slug,
        existing ? { ...space, ...existing } : space,
      );
    }
    return Array.from(spacesBySlug.values());
  }, [spaces, inferredSpacesFromAssets]);

  const spaceSlugs = React.useMemo(
    () => uniqueSpaces.map((space) => space.slug),
    [uniqueSpaces],
  );

  const tokenMetadataByAddress = React.useMemo(() => {
    const map = new Map<string, { icon: string; symbol: string }>();
    for (const asset of userAssets) {
      if (!asset.address) continue;
      map.set(asset.address.toLowerCase(), {
        icon: asset.icon,
        symbol: asset.symbol,
      });
    }
    return map;
  }, [userAssets]);

  const tokenTypeByAddress = React.useMemo(() => {
    const map = new Map<string, TokenType>();
    for (const asset of userAssets) {
      if (!asset.address) continue;
      const raw = asset.type;
      if (validTokenTypes.includes(raw as TokenType)) {
        map.set(asset.address.toLowerCase(), raw as TokenType);
      }
    }
    return map;
  }, [userAssets]);

  const tokenBalancesBySpaceAndAddress = React.useMemo(() => {
    const bySpaceAndAddress = new Map<string, number>();
    const byAddress = new Map<string, number>();
    for (const asset of userAssets) {
      if (!asset.address) continue;
      const addressKey = asset.address.toLowerCase();
      if (!byAddress.has(addressKey)) {
        byAddress.set(addressKey, asset.value);
      }
      if (asset.space?.slug) {
        bySpaceAndAddress.set(`${asset.space.slug}:${addressKey}`, asset.value);
      }
    }
    return { bySpaceAndAddress, byAddress };
  }, [userAssets]);

  const getTokenAvailableBalance = React.useCallback(
    (tokenAddress: string, spaceSlug?: string): number | undefined => {
      const addressKey = tokenAddress.toLowerCase();
      if (spaceSlug) {
        const scopedValue =
          tokenBalancesBySpaceAndAddress.bySpaceAndAddress.get(
            `${spaceSlug}:${addressKey}`,
          );
        if (typeof scopedValue === 'number') {
          return scopedValue;
        }
      }
      return tokenBalancesBySpaceAndAddress.byAddress.get(addressKey);
    },
    [tokenBalancesBySpaceAndAddress],
  );

  const { data: redeemableData } = useSWR<{
    tokens: Token[];
    diagnostics: RedeemDiscoveryDiagnostics;
  }>(
    jwt && spaceSlugs.length > 0
      ? [
          'redeemable-space-tokens',
          jwt,
          spaceSlugs.join(','),
          personData?.address ?? '',
        ]
      : null,
    async () => {
      const redeemableTokensAcrossSpaces: Token[] = [];
      const diagnostics: RedeemDiscoveryDiagnostics = {
        vaultFetch: [],
        checkedVaultTokenCount: 0,
        balanceReadFailureCount: 0,
      };
      const now = Date.now();
      const memberAddress = personData?.address as `0x${string}` | undefined;
      if (!memberAddress) {
        return { tokens: [], diagnostics };
      }

      const spaceResults = await Promise.all(
        uniqueSpaces.map(async (space) => {
          const headers = {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          };
          const vaultsRes = await fetch(
            `/api/v1/spaces/${space.slug}/vaults?redeemableOnly=true`,
            {
              headers,
            },
          );

          if (!vaultsRes.ok) {
            diagnostics.vaultFetch.push({
              spaceSlug: space.slug,
              status: vaultsRes.status,
            });
            return [];
          }

          const vaultsPayload = (await vaultsRes.json()) as SpaceVaultsResponse;
          const resolvedWeb3SpaceId =
            typeof vaultsPayload.web3SpaceId === 'number'
              ? vaultsPayload.web3SpaceId
              : typeof space.web3SpaceId === 'number'
              ? space.web3SpaceId
              : undefined;
          const activeVaultTokens = (vaultsPayload.vaults ?? []).filter(
            (vault) => {
              if (vault.redemptionEnabled !== true) return false;
              if (!vault.redemptionStartDate) return true;
              const startDate = new Date(vault.redemptionStartDate);
              return (
                Number.isNaN(startDate.getTime()) || startDate.getTime() <= now
              );
            },
          );
          diagnostics.checkedVaultTokenCount += activeVaultTokens.length;

          const balanceResults =
            activeVaultTokens.length === 0
              ? []
              : await publicClient.multicall({
                  allowFailure: true,
                  contracts: activeVaultTokens.map((vaultToken) => ({
                    address: vaultToken.spaceToken as `0x${string}`,
                    abi: erc20Abi,
                    functionName: 'balanceOf' as const,
                    args: [memberAddress],
                  })),
                });

          return balanceResults
            .map((balanceResult, index) => {
              const vaultToken = activeVaultTokens[index]!;
              if (balanceResult.status !== 'success') {
                diagnostics.balanceReadFailureCount += 1;
                return { token: vaultToken, hasBalance: false };
              }
              return {
                token: vaultToken,
                hasBalance: balanceResult.result > 0n,
              };
            })
            .filter((entry) => entry.hasBalance)
            .map((entry) => ({
              icon: entry.token.tokenIcon || '/placeholder/token-icon.svg',
              symbol: entry.token.tokenSymbol || 'UNKNOWN',
              address: entry.token.spaceToken as `0x${string}`,
              tokenPrice: entry.token.redemptionPrice,
              value: getTokenAvailableBalance(
                entry.token.spaceToken,
                space.slug,
              ),
              space: {
                title: space.title,
                slug: space.slug,
                web3SpaceId: resolvedWeb3SpaceId,
              },
            }));
        }),
      );

      const seen = new Set<string>();
      for (const tokenList of spaceResults) {
        for (const token of tokenList) {
          const key = `${
            token.space?.slug ?? ''
          }:${token.address.toLowerCase()}`;
          if (seen.has(key)) continue;
          seen.add(key);
          redeemableTokensAcrossSpaces.push(token);
        }
      }
      return {
        tokens: redeemableTokensAcrossSpaces,
        diagnostics,
      };
    },
  );

  const tokens = React.useMemo(() => {
    const list = redeemableData?.tokens ?? [];
    return list.map((token) => {
      const meta = tokenMetadataByAddress.get(token.address.toLowerCase());
      const liveValue = getTokenAvailableBalance(
        token.address,
        token.space?.slug,
      );
      return {
        ...token,
        ...(meta ?? {}),
        value: typeof liveValue === 'number' ? liveValue : token.value,
        type:
          tokenTypeByAddress.get(token.address.toLowerCase()) ??
          token.type ??
          null,
      };
    });
  }, [
    getTokenAvailableBalance,
    redeemableData?.tokens,
    tokenMetadataByAddress,
    tokenTypeByAddress,
  ]);
  const isCoreLoading = personLoading || spacesLoading;
  const isTokensLoading = Boolean(jwt) && !redeemableData;

  return (
    <ProposalOverlayShell>
      <div className="flex flex-col gap-5">
        <ModalStickyNavigation
          contextTitle={tModalAside('redeemTokens')}
          closeUrl={`/${lang}/profile/${personSlug}`}
          backUrl={`/${lang}/profile/${personSlug}/actions`}
          backLabel={tActions('backToActions')}
        />
        <span className="text-2 text-neutral-11">{tRedeem('content')}</span>
        <Separator />
        {isCoreLoading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-10 py-8">
            <Loader2 className="animate-spin w-5 h-5" />
            {tRedeem('loading')}
          </div>
        ) : (
          <PeopleRedeemForm
            tokens={tokens}
            updateAssets={manualUpdate}
            isLoadingTokens={isTokensLoading}
          />
        )}
      </div>
    </ProposalOverlayShell>
  );
};
