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
import { useJwt, useMe } from '@hypha-platform/core/client';
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

const writeDebugLog = async (payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data: Record<string, unknown>;
  timestamp: number;
}) => {
  try {
    await fetch('/api/v1/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // no-op
  }
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
  const { person } = useMe();

  const { data: spaces } = useSWR<SpaceSummary[]>(
    jwt ? `/api/v1/people/${personSlug}/spaces` : null,
    async (url: string) => {
      // #region agent log
      void writeDebugLog({
        hypothesisId: 'A',
        location: 'people-redeem-tokens.tsx:spaces-fetch:start',
        message: 'Fetching member spaces',
        data: { personSlug, hasJwt: Boolean(jwt) },
        timestamp: Date.now(),
      });
      // #endregion
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Failed to load spaces: ${res.statusText}`);
      }
      const payload = (await res.json()) as SpaceSummary[];
      // #region agent log
      void writeDebugLog({
        hypothesisId: 'A',
        location: 'people-redeem-tokens.tsx:spaces-fetch:done',
        message: 'Member spaces loaded',
        data: {
          count: payload.length,
          slugs: payload.map((space) => space.slug),
        },
        timestamp: Date.now(),
      });
      // #endregion
      return payload;
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

  const { data: redeemableTokens } = useSWR<Token[]>(
    jwt && spaceSlugs.length > 0
      ? [
          'redeemable-space-tokens',
          jwt,
          spaceSlugs.join(','),
          person?.address ?? '',
        ]
      : null,
    async () => {
      const redeemableTokensAcrossSpaces: Token[] = [];
      const now = Date.now();
      const memberAddress = person?.address as `0x${string}` | undefined;
      // #region agent log
      void writeDebugLog({
        hypothesisId: 'C',
        location: 'people-redeem-tokens.tsx:redeemable-fetch:start',
        message: 'Starting redeemable token scan',
        data: {
          uniqueSpaces: uniqueSpaces.length,
          hasMemberAddress: Boolean(memberAddress),
          memberAddress,
        },
        timestamp: Date.now(),
      });
      // #endregion
      if (!memberAddress) return [];

      const spaceResults = await Promise.all(
        uniqueSpaces.map(async (space) => {
          const headers = {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          };
          const vaultsRes = await fetch(`/api/v1/spaces/${space.slug}/vaults`, {
            headers,
          });
          // #region agent log
          void writeDebugLog({
            hypothesisId: 'B',
            location: 'people-redeem-tokens.tsx:vault-fetch:status',
            message: 'Vault fetch response received',
            data: { spaceSlug: space.slug, status: vaultsRes.status },
            timestamp: Date.now(),
          });
          // #endregion

          if (!vaultsRes.ok) {
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
                // #region agent log
                void writeDebugLog({
                  hypothesisId: 'D',
                  location: 'people-redeem-tokens.tsx:balance-check:error',
                  message: 'balanceOf read failed',
                  data: {
                    spaceSlug: space.slug,
                    token: vaultToken.spaceToken,
                    memberAddress,
                  },
                  timestamp: Date.now(),
                });
                // #endregion
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

      // #region agent log
      void writeDebugLog({
        hypothesisId: 'A',
        location: 'people-redeem-tokens.tsx:redeemable-fetch:done',
        message: 'Redeemable token scan completed',
        data: { count: redeemableTokensAcrossSpaces.length },
        timestamp: Date.now(),
      });
      // #endregion
      return redeemableTokensAcrossSpaces;
    },
  );

  const tokens = redeemableTokens ?? [];

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
        <Separator />
        <PeopleRedeemForm tokens={tokens} updateAssets={manualUpdate} />
      </div>
    </SidePanel>
  );
};
