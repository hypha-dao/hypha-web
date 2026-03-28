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

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
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
    redemptionEnabled?: boolean;
    redemptionStartDate?: string | Date;
    tokenName?: string;
  }>;
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

  const { data: spaces } = useSWR<SpaceSummary[]>(
    jwt ? `/api/v1/people/${personSlug}/spaces` : null,
    async (url) => {
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

  const spaceSlugs = React.useMemo(
    () => (spaces ?? []).map((space) => space.slug),
    [spaces],
  );

  const { data: redeemableTokens } = useSWR<Token[]>(
    jwt && spaceSlugs.length > 0
      ? ['redeemable-space-tokens', jwt, spaceSlugs.join(',')]
      : null,
    async () => {
      const tokensByAddress = new Map<string, Token>();
      const now = Date.now();

      const spaceResults = await Promise.all(
        (spaces ?? []).map(async (space) => {
          const headers = {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          };
          const vaultsRes = await fetch(`/api/v1/spaces/${space.slug}/vaults`, {
            headers,
          });

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

          return activeVaultTokens.map((vaultToken) => {
            return {
              icon: vaultToken.tokenIcon || '/placeholder/token-icon.svg',
              symbol: vaultToken.tokenSymbol || 'UNKNOWN',
              address: vaultToken.spaceToken as `0x${string}`,
              type: undefined,
              space: {
                title: space.title,
                slug: space.slug,
              },
            } satisfies Token;
          });
        }),
      );

      for (const tokenList of spaceResults) {
        for (const token of tokenList) {
          tokensByAddress.set(token.address.toLowerCase(), token);
        }
      }

      return Array.from(tokensByAddress.values());
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
