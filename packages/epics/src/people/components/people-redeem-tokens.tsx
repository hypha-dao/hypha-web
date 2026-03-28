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
  }>;
};

type SpaceAssetsResponse = {
  assets?: Array<{
    address: string;
    symbol: string;
    icon: string;
    type?: string | null;
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

      const spaceResults = await Promise.all(
        (spaces ?? []).map(async (space) => {
          const headers = {
            Authorization: `Bearer ${jwt}`,
            'Content-Type': 'application/json',
          };
          const [vaultsRes, assetsRes] = await Promise.all([
            fetch(`/api/v1/spaces/${space.slug}/vaults`, { headers }),
            fetch(`/api/v1/spaces/${space.slug}/assets`, { headers }),
          ]);

          if (!vaultsRes.ok || !assetsRes.ok) {
            return [];
          }

          const vaultsPayload = (await vaultsRes.json()) as SpaceVaultsResponse;
          const assetsPayload = (await assetsRes.json()) as SpaceAssetsResponse;

          const treasuryAssetsByAddress = new Map(
            (assetsPayload.assets ?? []).map((asset) => [
              asset.address.toLowerCase(),
              asset,
            ]),
          );

          const activeVaultTokens = (vaultsPayload.vaults ?? []).filter(
            (vault) => vault.redemptionEnabled === true,
          );

          return activeVaultTokens
            .map((vaultToken) => {
              const lowerAddress = vaultToken.spaceToken.toLowerCase();
              const treasuryToken = treasuryAssetsByAddress.get(lowerAddress);
              if (!treasuryToken) {
                return null;
              }
              return {
                icon:
                  treasuryToken.icon ||
                  vaultToken.tokenIcon ||
                  '/placeholder/token-icon.svg',
                symbol:
                  treasuryToken.symbol || vaultToken.tokenSymbol || 'UNKNOWN',
                address: vaultToken.spaceToken as `0x${string}`,
                type: treasuryToken.type ?? undefined,
                space: {
                  title: space.title,
                  slug: space.slug,
                },
              } satisfies Token;
            })
            .filter((token): token is Token => token !== null);
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
