'use client';

import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { TokenPercentageFieldArray } from '../components/common/token-percentage-field-array';
import { Skeleton } from '@hypha-platform/ui';
import {
  Person,
  Space,
  TokenType,
  validTokenTypes,
} from '@hypha-platform/core/client';
import {
  useTokens,
  useVaults,
  type Vault,
  type AssetItem,
} from '../../../treasury';

const PERCENT_SCALE = 100;
const PERCENT_BASE = 100 * PERCENT_SCALE;

const formatPercent = (value: number) => value.toFixed(2);

const rebalanceByUsd = (
  assets: Array<{ address: string; usdEqual?: number }>,
): Array<{ asset: string; percentage: string }> => {
  if (assets.length === 0) return [];
  const weights = assets.map((asset) =>
    typeof asset.usdEqual === 'number' && asset.usdEqual > 0
      ? asset.usdEqual
      : 0,
  );
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  if (totalWeight <= 0) {
    const baseShare = Math.floor(PERCENT_BASE / assets.length);
    const remainder = PERCENT_BASE - baseShare * assets.length;
    return assets.map((asset, index) => ({
      asset: asset.address,
      percentage: formatPercent(
        (baseShare + (index < remainder ? 1 : 0)) / PERCENT_SCALE,
      ),
    }));
  }
  const exactShares = weights.map(
    (weight) => (weight / totalWeight) * PERCENT_BASE,
  );
  const floorShares = exactShares.map((share) => Math.floor(share));
  let distributed = floorShares.reduce((sum, value) => sum + value, 0);
  const order = exactShares
    .map((share, index) => ({
      index,
      fraction: share - (floorShares[index] ?? 0),
    }))
    .sort((a, b) => b.fraction - a.fraction);
  let cursor = 0;
  while (distributed < PERCENT_BASE && cursor < order.length) {
    const next = order[cursor];
    if (!next) break;
    const currentShare = floorShares[next.index] ?? 0;
    floorShares[next.index] = currentShare + 1;
    distributed += 1;
    cursor += 1;
  }
  return assets.map((asset, index) => {
    const share = floorShares[index] ?? 0;
    return {
      asset: asset.address,
      percentage: formatPercent(share / PERCENT_SCALE),
    };
  });
};

function isRedemptionActive(vault: Vault, now: number): boolean {
  if (vault.redemptionEnabled !== true) return false;
  if (!vault.redemptionStartDate) return true;
  const startDate = new Date(vault.redemptionStartDate);
  return Number.isNaN(startDate.getTime()) || startDate.getTime() <= now;
}

export const RedeemTokensPlugin = ({
  spaceSlug,
  spaces,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
  web3SpaceId?: number | null;
}) => {
  const form = useFormContext();
  const { vaults, isLoading: isVaultsLoading } = useVaults();
  const { tokens: spaceTokensForTypes } = useTokens({ spaceSlug });

  const tokenTypeByAddress = React.useMemo(() => {
    const map = new Map<string, TokenType | null>();
    for (const t of spaceTokensForTypes) {
      const raw = t.type;
      map.set(
        t.address.toLowerCase(),
        validTokenTypes.includes(raw as TokenType) ? (raw as TokenType) : null,
      );
    }
    return map;
  }, [spaceTokensForTypes]);

  const spaceTitle = React.useMemo(() => {
    const match = spaces?.find((s) => s.slug === spaceSlug);
    return match?.title ?? spaceSlug;
  }, [spaces, spaceSlug]);

  const redeemableTokens = React.useMemo(() => {
    const now = Date.now();
    return vaults
      .filter((vault) => isRedemptionActive(vault, now))
      .map((vault) => ({
        icon: vault.tokenIcon || '/placeholder/token-icon.svg',
        symbol: vault.tokenSymbol || 'UNKNOWN',
        address: vault.spaceToken as `0x${string}`,
        type:
          tokenTypeByAddress.get(vault.spaceToken.toLowerCase()) ?? undefined,
        space: {
          title: spaceTitle,
          slug: spaceSlug,
        },
      }));
  }, [vaults, spaceSlug, spaceTitle, tokenTypeByAddress]);

  const redemptions = useWatch({
    control: form.control,
    name: 'redemptions',
  });
  const selectedRedemption = redemptions?.[0];

  const selectedTokenVault = React.useMemo(
    () =>
      vaults.find(
        (vault) =>
          vault.spaceToken.toLowerCase() ===
          (selectedRedemption?.token ?? '').toLowerCase(),
      ),
    [vaults, selectedRedemption?.token],
  );

  const conversionCollaterals = React.useMemo((): AssetItem[] => {
    return (selectedTokenVault?.collaterals ?? []).map((collateral) => {
      const createdAt =
        collateral.createdAt instanceof Date
          ? collateral.createdAt
          : collateral.createdAt
          ? new Date(collateral.createdAt)
          : undefined;
      return {
        icon: collateral.icon,
        name: collateral.name,
        symbol: collateral.symbol,
        value: collateral.value,
        usdEqual: collateral.usdEqual,
        tokenPrice: collateral.tokenPrice,
        type: '',
        chartData: [],
        transactions: [],
        closeUrl: '',
        slug: collateral.address,
        address: collateral.address,
        space: collateral.space ?? {
          title: spaceTitle,
          slug: spaceSlug,
        },
        createdAt,
      };
    });
  }, [selectedTokenVault?.collaterals, spaceSlug, spaceTitle]);

  const autoPopulateSignature = React.useMemo(
    () =>
      `${selectedRedemption?.token ?? ''}|${conversionCollaterals
        .map((c) => `${c.address}:${c.usdEqual ?? 0}`)
        .join(',')}`,
    [selectedRedemption?.token, conversionCollaterals],
  );

  const lastAutoPopulateRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!selectedRedemption?.token || conversionCollaterals.length === 0)
      return;
    if (lastAutoPopulateRef.current === autoPopulateSignature) return;
    const autoConversions = rebalanceByUsd(
      conversionCollaterals.map((c) => ({
        address: c.address ?? '',
        usdEqual: c.usdEqual,
      })),
    );
    if (autoConversions.length === 0) return;
    form.setValue('conversions', autoConversions, {
      shouldDirty: true,
      shouldValidate: true,
    });
    lastAutoPopulateRef.current = autoPopulateSignature;
  }, [
    autoPopulateSignature,
    conversionCollaterals,
    form,
    selectedRedemption?.token,
  ]);

  React.useEffect(() => {
    const currentConversions = form.getValues('conversions');
    if (!currentConversions?.length) return;

    const allowed = new Set(
      conversionCollaterals.map((c) => (c.address ?? '').toLowerCase()),
    );

    let hasInvalid = false;
    const next = currentConversions.map(
      (conversion: { asset: string; percentage: string }, index: number) => {
        if (allowed.has(conversion.asset.toLowerCase())) {
          return conversion;
        }
        hasInvalid = true;
        return {
          ...conversion,
          asset: index === 0 ? conversionCollaterals[0]?.address ?? '' : '',
        };
      },
    );

    if (!hasInvalid) return;

    form.setValue('conversions', next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [conversionCollaterals, form]);

  return (
    <div className="flex flex-col gap-4">
      <Skeleton loading={isVaultsLoading} width={'100%'} height={90}>
        <TokenPayoutFieldArray
          tokens={redeemableTokens}
          name="redemptions"
          label="Redemption Amount"
          allowAddOrRemove={false}
        />
      </Skeleton>
      <Skeleton loading={isVaultsLoading} width={'100%'} height={90}>
        {selectedRedemption?.token ? (
          <TokenPercentageFieldArray
            assets={conversionCollaterals}
            name="conversions"
            label="Converted into"
          />
        ) : null}
      </Skeleton>
    </div>
  );
};
