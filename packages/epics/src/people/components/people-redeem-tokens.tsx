'use client';

import React from 'react';
import {
  SidePanel,
  ButtonClose,
  ButtonBack,
  useUserAssets,
} from '@hypha-platform/epics';
import { PeopleRedeemForm } from './people-redeem-form';
import { Separator } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  getSpaceDecayingTokens,
  getSpaceOwnershipTokens,
  getSpaceRegularTokens,
  publicClient,
  TokenType,
  useJwt,
  validTokenTypes,
} from '@hypha-platform/core/client';
import useSWR from 'swr';
import {
  tokenBackingVaultImplementationAbi,
  tokenBackingVaultImplementationAddress,
} from '@hypha-platform/core/generated';
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
  restrictedFallbackSpaces: string[];
  restrictedFallbackFailureCount: number;
};

export const ProfileRedeemTokens = ({
  lang,
  personSlug,
}: ProfileRedeemTokensProps) => {
  const tRedeem = useTranslations('ProfileActions.redeemTokens');
  const tActions = useTranslations('ProfileActions');
  const chainId = 8453 as keyof typeof tokenBackingVaultImplementationAddress;
  const vaultAddress = tokenBackingVaultImplementationAddress[chainId];
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

  const resolveRestrictedSpaceTokens = React.useCallback(
    async (
      space: SpaceSummary,
      memberAddress: `0x${string}`,
    ): Promise<Token[]> => {
      const web3SpaceId = Number(space.web3SpaceId ?? 0);
      if (!vaultAddress || !Number.isFinite(web3SpaceId) || web3SpaceId <= 0) {
        return [];
      }
      const spaceId = BigInt(web3SpaceId);
      const [regularResult, ownershipResult, decayingResult] =
        await publicClient.multicall({
          allowFailure: true,
          contracts: [
            getSpaceRegularTokens({ spaceId }),
            getSpaceOwnershipTokens({ spaceId }),
            getSpaceDecayingTokens({ spaceId }),
          ],
        });
      const regularTokens =
        regularResult.status === 'success' ? regularResult.result : [];
      const ownershipTokens =
        ownershipResult.status === 'success' ? ownershipResult.result : [];
      const decayingTokens =
        decayingResult.status === 'success' ? decayingResult.result : [];
      const allSpaceTokens = [
        ...regularTokens,
        ...ownershipTokens,
        ...decayingTokens,
      ] as `0x${string}`[];
      const uniqueSpaceTokens = Array.from(
        new Set(allSpaceTokens.map((token) => token.toLowerCase())),
      ) as `0x${string}`[];
      if (uniqueSpaceTokens.length === 0) {
        return [];
      }

      const vaultExistsResults = await publicClient.multicall({
        allowFailure: true,
        contracts: uniqueSpaceTokens.map((spaceToken) => ({
          address: vaultAddress,
          abi: tokenBackingVaultImplementationAbi,
          functionName: 'vaultExists' as const,
          args: [spaceId, spaceToken],
        })),
      });
      const vaultSpaceTokens = uniqueSpaceTokens.filter(
        (_, index) =>
          vaultExistsResults[index]?.status === 'success' &&
          vaultExistsResults[index]?.result === true,
      );
      if (vaultSpaceTokens.length === 0) {
        return [];
      }

      const [vaultConfigResults, redemptionPriceResults, balanceResults] =
        await Promise.all([
          publicClient.multicall({
            allowFailure: true,
            contracts: vaultSpaceTokens.map((spaceToken) => ({
              address: vaultAddress,
              abi: tokenBackingVaultImplementationAbi,
              functionName: 'getVaultConfig' as const,
              args: [spaceId, spaceToken],
            })),
          }),
          publicClient.multicall({
            allowFailure: true,
            contracts: vaultSpaceTokens.map((spaceToken) => ({
              address: vaultAddress,
              abi: tokenBackingVaultImplementationAbi,
              functionName: 'getRedemptionPrice' as const,
              args: [spaceId, spaceToken],
            })),
          }),
          publicClient.multicall({
            allowFailure: true,
            contracts: vaultSpaceTokens.map((spaceToken) => ({
              address: spaceToken,
              abi: erc20Abi,
              functionName: 'balanceOf' as const,
              args: [memberAddress],
            })),
          }),
        ]);

      const fallbackTokens: Token[] = [];
      for (const [index, spaceToken] of vaultSpaceTokens.entries()) {
        const configResult = vaultConfigResults[index];
        const config =
          configResult?.status === 'success'
            ? (configResult.result as {
                redeemEnabled?: boolean;
                redemptionStartDate?: bigint;
              })
            : undefined;
        if (!config?.redeemEnabled) {
          continue;
        }
        const redemptionStartDateSeconds = Number(
          config.redemptionStartDate ?? 0n,
        );
        if (
          redemptionStartDateSeconds > 0 &&
          redemptionStartDateSeconds * 1000 > Date.now()
        ) {
          continue;
        }
        const balanceResult = balanceResults[index];
        const hasBalance =
          balanceResult?.status === 'success' && balanceResult.result > 0n;
        if (!hasBalance) {
          continue;
        }
        const priceResult = redemptionPriceResults[index];
        const rawRedemptionPrice =
          priceResult?.status === 'success' &&
          Array.isArray(priceResult.result) &&
          typeof priceResult.result[0] === 'bigint'
            ? priceResult.result[0]
            : 0n;
        const redemptionPrice =
          rawRedemptionPrice > 0n
            ? Number(rawRedemptionPrice) / 1_000_000
            : undefined;
        const meta = tokenMetadataByAddress.get(spaceToken.toLowerCase());
        fallbackTokens.push({
          icon: meta?.icon || '/placeholder/token-icon.svg',
          symbol: meta?.symbol || 'UNKNOWN',
          address: spaceToken,
          tokenPrice: redemptionPrice,
          value: getTokenAvailableBalance(spaceToken, space.slug),
          space: {
            title: space.title,
            slug: space.slug,
          },
        });
      }
      return fallbackTokens;
    },
    [getTokenAvailableBalance, tokenMetadataByAddress, vaultAddress],
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
        restrictedFallbackSpaces: [],
        restrictedFallbackFailureCount: 0,
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
          const vaultsRes = await fetch(`/api/v1/spaces/${space.slug}/vaults`, {
            headers,
          });

          if (!vaultsRes.ok) {
            const isRestrictedSpace = vaultsRes.status === 403;
            if (isRestrictedSpace) {
              try {
                const fallbackTokens = await resolveRestrictedSpaceTokens(
                  space,
                  memberAddress,
                );
                diagnostics.restrictedFallbackSpaces.push(space.slug);
                return fallbackTokens;
              } catch {
                diagnostics.restrictedFallbackFailureCount += 1;
              }
            }
            diagnostics.vaultFetch.push({
              spaceSlug: space.slug,
              status: vaultsRes.status,
            });
            return [];
          }

          const vaultsPayload = (await vaultsRes.json()) as SpaceVaultsResponse;
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
  const diagnostics = redeemableData?.diagnostics;
  const vaultFetchDiagnostics = diagnostics?.vaultFetch ?? [];
  const hasVaultAccessIssues = vaultFetchDiagnostics.length > 0;
  const hasMemberAddress = Boolean(personData?.address);
  const hasSpaces = uniqueSpaces.length > 0;
  const hasTokens = tokens.length > 0;
  const isCoreLoading =
    personLoading || spacesLoading || (hasSpaces && !redeemableData);
  const emptyStateReasons = React.useMemo(() => {
    const reasons: string[] = [];
    if (!jwt) {
      reasons.push(tRedeem('diagnostics.reasons.missingJwt'));
    }
    if (personError) {
      reasons.push(tRedeem('diagnostics.reasons.profileLoadFailed'));
    }
    if (!personLoading && !hasMemberAddress) {
      reasons.push(tRedeem('diagnostics.reasons.noWalletAddress'));
    }
    if (spacesError) {
      reasons.push(tRedeem('diagnostics.reasons.spacesLoadFailed'));
    }
    if (
      !spacesLoading &&
      jwt &&
      (spaces?.length ?? 0) === 0 &&
      inferredSpacesFromAssets.length > 0
    ) {
      reasons.push(tRedeem('diagnostics.reasons.spacesFallback'));
    }
    if (!spacesLoading && jwt && !hasSpaces) {
      reasons.push(tRedeem('diagnostics.reasons.noSpaces'));
    }
    if (
      diagnostics &&
      diagnostics.checkedVaultTokenCount > 0 &&
      diagnostics.balanceReadFailureCount > 0
    ) {
      reasons.push(
        tRedeem('diagnostics.reasons.balanceReadFailed', {
          failed: diagnostics.balanceReadFailureCount,
          total: diagnostics.checkedVaultTokenCount,
        }),
      );
    }
    if (
      diagnostics &&
      diagnostics.checkedVaultTokenCount === 0 &&
      hasSpaces &&
      !hasVaultAccessIssues &&
      diagnostics.restrictedFallbackSpaces.length === 0
    ) {
      reasons.push(tRedeem('diagnostics.reasons.noVaultTokens'));
    }
    if (diagnostics && diagnostics.restrictedFallbackSpaces.length > 0) {
      reasons.push(
        tRedeem('diagnostics.reasons.restrictedFallback', {
          spaces: diagnostics.restrictedFallbackSpaces.join(', '),
        }),
      );
    }
    if (diagnostics && diagnostics.restrictedFallbackFailureCount > 0) {
      reasons.push(
        tRedeem('diagnostics.reasons.restrictedFallbackFailed', {
          count: diagnostics.restrictedFallbackFailureCount,
        }),
      );
    }
    return reasons;
  }, [
    diagnostics,
    hasMemberAddress,
    hasSpaces,
    hasVaultAccessIssues,
    jwt,
    personError,
    personLoading,
    spaces,
    spacesError,
    spacesLoading,
    inferredSpacesFromAssets.length,
  ]);

  return (
    <SidePanel>
      <div className="flex flex-col gap-5">
        <div className="flex gap-5 justify-between">
          <h2 className="text-4 text-secondary-foreground justify-start items-center">
            {tRedeem('title')}
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label={tActions('backToActions')}
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
        <span className="text-2 text-neutral-11">{tRedeem('content')}</span>
        {hasVaultAccessIssues && (
          <div className="text-2 text-red-11">
            {tRedeem('diagnostics.vaultAccess', {
              details: vaultFetchDiagnostics
                .map((entry) => `${entry.spaceSlug} (${entry.status})`)
                .join(', '),
            })}
          </div>
        )}
        {!isCoreLoading && !hasTokens && emptyStateReasons.length > 0 && (
          <div className="text-2 text-yellow-11">
            {tRedeem('diagnostics.tokenDiscovery', {
              reasons: emptyStateReasons.join('; '),
            })}
          </div>
        )}
        <Separator />
        {isCoreLoading ? (
          <div className="flex items-center gap-2 text-sm text-neutral-10 py-8">
            <Loader2 className="animate-spin w-5 h-5" />
            {tRedeem('loading')}
          </div>
        ) : (
          <PeopleRedeemForm tokens={tokens} updateAssets={manualUpdate} />
        )}
      </div>
    </SidePanel>
  );
};
