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

export const ProfileRedeemTokens = ({
  lang,
  personSlug,
}: ProfileRedeemTokensProps) => {
  const { manualUpdate } = useUserAssets({
    personSlug,
    refreshInterval: 10000,
  });
  const { jwt } = useJwt();
  const { data: personData } = useSWR<{ address?: string }>(
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

  const { data: spaces } = useSWR<SpaceSummary[]>(
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

  const uniqueSpaces = React.useMemo(() => {
    const spacesBySlug = new Map<string, SpaceSummary>();
    for (const space of spaces ?? []) {
      if (!space.slug) continue;
      spacesBySlug.set(space.slug, space);
    }
    return Array.from(spacesBySlug.values());
  }, [spaces]);

  const spaceSlugs = React.useMemo(
    () => uniqueSpaces.map((space) => space.slug),
    [uniqueSpaces],
  );

  const { data: redeemableData } = useSWR<{
    tokens: Token[];
    diagnostics: VaultFetchDiagnostic[];
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
      const diagnostics: VaultFetchDiagnostic[] = [];
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
            diagnostics.push({
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
  const diagnostics = redeemableData?.diagnostics ?? [];
  const hasVaultAccessIssues = diagnostics.length > 0;

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
            {diagnostics
              .map((entry) => `${entry.spaceSlug} (${entry.status})`)
              .join(', ')}
            . You may not have access to those spaces.
          </div>
        )}
        <Separator />
        <PeopleRedeemForm tokens={tokens} updateAssets={manualUpdate} />
      </div>
    </SidePanel>
  );
};
