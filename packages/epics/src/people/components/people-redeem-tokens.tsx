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
import { useJwt } from '@hypha-platform/core/client';
import useSWR from 'swr';
import { publicClient } from '@hypha-platform/core/client';
import { erc20Abi } from 'viem';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  tokenPrice?: number;
  type?: string;
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
};

export const ProfileRedeemTokens = ({
  lang,
  personSlug,
}: ProfileRedeemTokensProps) => {
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
    jwt ? `/api/v1/people/${personSlug}/spaces` : null,
    async (url: string) => {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${jwt}`,
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
      spacesBySlug.set(space.slug, space);
    }
    return Array.from(spacesBySlug.values());
  }, [spaces, inferredSpacesFromAssets]);

  const spaceSlugs = React.useMemo(
    () => uniqueSpaces.map((space) => space.slug),
    [uniqueSpaces],
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
          const vaultsRes = await fetch(`/api/v1/spaces/${space.slug}/vaults`, {
            headers,
          });

          if (!vaultsRes.ok) {
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

          const balances = await Promise.all(
            activeVaultTokens.map(async (vaultToken) => {
              try {
                const balance = await publicClient.readContract({
                  address: vaultToken.spaceToken as `0x${string}`,
                  abi: erc20Abi,
                  functionName: 'balanceOf',
                  args: [memberAddress],
                });
                return {
                  token: vaultToken,
                  hasBalance: balance > 0n,
                };
              } catch {
                diagnostics.balanceReadFailureCount += 1;
                return {
                  token: vaultToken,
                  hasBalance: false,
                };
              }
            }),
          );

          return balances
            .filter((entry) => entry.hasBalance)
            .map((entry) => ({
              icon: entry.token.tokenIcon || '/placeholder/token-icon.svg',
              symbol: entry.token.tokenSymbol || 'UNKNOWN',
              address: entry.token.spaceToken as `0x${string}`,
              tokenPrice: entry.token.redemptionPrice,
              type: undefined,
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

  const tokens = redeemableData?.tokens ?? [];
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
      reasons.push('Missing authenticated session token');
    }
    if (personError) {
      reasons.push('Failed to load profile data');
    }
    if (!personLoading && !hasMemberAddress) {
      reasons.push('Profile has no wallet address');
    }
    if (spacesError) {
      reasons.push('Failed to load member spaces');
    }
    if (
      !spacesLoading &&
      jwt &&
      (spaces?.length ?? 0) === 0 &&
      inferredSpacesFromAssets.length > 0
    ) {
      reasons.push(
        'Membership spaces lookup returned no spaces; using wallet-token spaces fallback',
      );
    }
    if (!spacesLoading && jwt && !hasSpaces) {
      reasons.push('No spaces found for this member');
    }
    if (
      diagnostics &&
      diagnostics.checkedVaultTokenCount > 0 &&
      diagnostics.balanceReadFailureCount > 0
    ) {
      reasons.push(
        `Failed to read on-chain balances for ${diagnostics.balanceReadFailureCount}/${diagnostics.checkedVaultTokenCount} vault token(s)`,
      );
    }
    if (
      diagnostics &&
      diagnostics.checkedVaultTokenCount === 0 &&
      hasSpaces &&
      !hasVaultAccessIssues
    ) {
      reasons.push('No redemption-enabled vault tokens were found');
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
            Redeem Tokens
          </h2>
          <div className="flex gap-5 justify-end items-center">
            <ButtonBack
              label="Back to actions"
              backUrl={`/${lang}/profile/${personSlug}/actions`}
            />
            <ButtonClose closeUrl={`/${lang}/profile/${personSlug}`} />
          </div>
        </div>
        <span className="text-2 text-neutral-11">
          Convert your tokens into their equivalent fiat value held in the
          vault.
        </span>
        {hasVaultAccessIssues && (
          <div className="text-2 text-red-11">
            Unable to load vault data for some spaces:{' '}
            {vaultFetchDiagnostics
              .map((entry) => `${entry.spaceSlug} (${entry.status})`)
              .join(', ')}
            . You may not have access to those spaces.
          </div>
        )}
        {!isCoreLoading && !hasTokens && emptyStateReasons.length > 0 && (
          <div className="text-2 text-yellow-11">
            Token discovery diagnostics: {emptyStateReasons.join('; ')}.
          </div>
        )}
        <Separator />
        <PeopleRedeemForm tokens={tokens} updateAssets={manualUpdate} />
      </div>
    </SidePanel>
  );
};
