'use client';

import React from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import useSWR from 'swr';
import { useAuthentication } from '@hypha-platform/authentication';
import { TokenPayoutFieldArray } from '../components/common/token-payout-field-array';
import { TokenPercentageFieldArray } from '../components/common/token-percentage-field-array';
import type { TokenPercentageAsset } from '../components/common/token-percentage-field';
import { Skeleton } from '@hypha-platform/ui';
import {
  CURRENCY_FEED_OPTIONS,
  Person,
  Space,
  TokenType,
  publicClient,
  validTokenTypes,
} from '@hypha-platform/core/client';
import { useAssets, useTokens, useVaults, type Vault } from '../../../treasury';
import { useTranslations } from 'next-intl';
import { useRedeemSubmitGuardSetter } from './submit-guard-context';

const USD_FEED_ADDRESS = '0x0000000000000000000000000000000000000000';
const CURRENCY_CODE_BY_FEED = Object.fromEntries(
  CURRENCY_FEED_OPTIONS.map((option) => [
    option.value.toLowerCase(),
    option.label,
  ]),
);
const CURRENCY_SYMBOL_BY_CODE: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  CHF: 'CHF ',
  AUD: 'A$',
};

const chainlinkPriceFeedAbi = [
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'latestRoundData',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
] as const;

const getCurrencySymbol = (currencyCode?: string) =>
  CURRENCY_SYMBOL_BY_CODE[(currencyCode ?? 'USD').toUpperCase()] ?? '$';

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

type VaultOwnerSpace = {
  slug: string;
  title: string;
  web3SpaceId: number;
};

type VaultWithOwner = {
  owner: VaultOwnerSpace;
  vault: Vault;
};

export const RedeemTokensPlugin = ({
  spaceSlug,
  spaces,
  web3SpaceId,
}: {
  spaceSlug: string;
  members: Person[];
  spaces?: Space[];
  web3SpaceId?: number | null;
}) => {
  const tProposal = useTranslations(
    'AgreementFlow.plugins.redeemTokensProposal',
  );
  const tExchangeStakesAndTokens = useTranslations(
    'AgreementFlow.plugins.exchangeStakesAndTokens',
  );
  const { control, setValue, getValues } = useFormContext();
  const {
    getAccessToken,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthentication();
  const setSubmitGuard = useRedeemSubmitGuardSetter();
  const { vaults: currentSpaceVaults, isLoading: isCurrentSpaceVaultsLoading } =
    useVaults({ spaceSlug, redeemableOnly: true });
  const { assets: treasuryAssets, isLoading: isTreasuryAssetsLoading } =
    useAssets({ bestEffort: true });
  const { tokens: spaceTokensForTypes } = useTokens({ spaceSlug });

  const candidateSpaces = React.useMemo(() => {
    const bySlug = new Map<string, VaultOwnerSpace>();
    if (spaceSlug && typeof web3SpaceId === 'number') {
      bySlug.set(spaceSlug, {
        slug: spaceSlug,
        title: spaces?.find((s) => s.slug === spaceSlug)?.title ?? spaceSlug,
        web3SpaceId,
      });
    }
    for (const space of spaces ?? []) {
      if (!space.slug || typeof space.web3SpaceId !== 'number') continue;
      if (bySlug.has(space.slug)) continue;
      bySlug.set(space.slug, {
        slug: space.slug,
        title: space.title ?? space.slug,
        web3SpaceId: space.web3SpaceId,
      });
    }
    return Array.from(bySlug.values());
  }, [spaceSlug, spaces, web3SpaceId]);

  const currentSpaceOwner = React.useMemo(
    () => candidateSpaces.find((space) => space.slug === spaceSlug),
    [candidateSpaces, spaceSlug],
  );

  const otherCandidateSpaces = React.useMemo(
    () => candidateSpaces.filter((space) => space.slug !== spaceSlug),
    [candidateSpaces, spaceSlug],
  );

  const otherCandidateSpaceSlugs = React.useMemo(
    () => otherCandidateSpaces.map((space) => space.slug),
    [otherCandidateSpaces],
  );

  const { data: vaultsBySpace = [], isLoading: isCrossSpaceVaultsLoading } =
    useSWR<Array<{ owner: VaultOwnerSpace; vaults: Vault[] }>>(
      otherCandidateSpaceSlugs.length > 0 && !isAuthLoading
        ? ['redeem-vaults-by-space', ...otherCandidateSpaceSlugs]
        : null,
      async ([, ...slugs]) => {
        const token = await getAccessToken();
        if (!token && isAuthenticated) {
          throw new Error('Authentication token not available yet');
        }
        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const responses = await Promise.allSettled(
          slugs.map(async (slug) => {
            const owner = otherCandidateSpaces.find(
              (space) => space.slug === slug,
            );
            if (!owner) return null;
            const res = await fetch(
              `/api/v1/spaces/${slug}/vaults?redeemableOnly=true`,
              {
                headers,
              },
            );
            if (!res.ok) {
              return { owner, vaults: [] };
            }
            const payload = (await res.json()) as { vaults?: Vault[] };
            return { owner, vaults: payload.vaults ?? [] };
          }),
        );

        return responses
          .map((result) =>
            result.status === 'fulfilled' ? result.value : null,
          )
          .filter(
            (
              entry,
            ): entry is {
              owner: VaultOwnerSpace;
              vaults: Vault[];
            } => entry !== null,
          );
      },
      {
        revalidateOnFocus: false,
        shouldRetryOnError: true,
        errorRetryInterval: 1500,
      },
    );

  const vaultsWithOwners = React.useMemo((): VaultWithOwner[] => {
    const entries: VaultWithOwner[] = [];
    if (currentSpaceOwner) {
      for (const vault of currentSpaceVaults) {
        entries.push({
          owner: currentSpaceOwner,
          vault,
        });
      }
    }
    for (const group of vaultsBySpace) {
      for (const vault of group.vaults) {
        entries.push({
          owner: group.owner,
          vault,
        });
      }
    }
    return entries;
  }, [currentSpaceOwner, currentSpaceVaults, vaultsBySpace]);

  const treasuryBalanceByTokenAddress = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const asset of treasuryAssets) {
      const addr = asset.address?.toLowerCase();
      if (!addr) continue;
      map.set(addr, asset.value ?? 0);
    }
    return map;
  }, [treasuryAssets]);

  const treasuryTypeByTokenAddress = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const asset of treasuryAssets) {
      const addr = asset.address?.toLowerCase();
      if (!addr || !asset.type) continue;
      map.set(addr, asset.type);
    }
    return map;
  }, [treasuryAssets]);

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
    if (isTreasuryAssetsLoading) return [];
    const now = Date.now();
    return vaultsWithOwners
      .filter((entry) => isRedemptionActive(entry.vault, now))
      .filter((entry) => {
        const balance =
          treasuryBalanceByTokenAddress.get(
            entry.vault.spaceToken.toLowerCase(),
          ) ?? 0;
        return balance > 0;
      })
      .map((entry) => {
        const bal =
          treasuryBalanceByTokenAddress.get(
            entry.vault.spaceToken.toLowerCase(),
          ) ?? 0;
        return {
          icon: entry.vault.tokenIcon || '/placeholder/token-icon.svg',
          symbol: entry.vault.tokenSymbol || 'UNKNOWN',
          address: entry.vault.spaceToken as `0x${string}`,
          value: bal,
          type:
            tokenTypeByAddress.get(entry.vault.spaceToken.toLowerCase()) ??
            undefined,
          vaultWeb3SpaceId: entry.owner.web3SpaceId,
          space: {
            title: entry.owner.title,
            slug: entry.owner.slug,
          },
        };
      });
  }, [
    isTreasuryAssetsLoading,
    tokenTypeByAddress,
    treasuryBalanceByTokenAddress,
    vaultsWithOwners,
  ]);

  const isLoadingRedeemableTokens =
    isCurrentSpaceVaultsLoading ||
    isCrossSpaceVaultsLoading ||
    isTreasuryAssetsLoading;

  const redemptions = useWatch({
    control,
    name: 'redemptions',
  });
  const selectedRedemption = redemptions?.[0];
  const selectedVaultWeb3SpaceId = useWatch({
    control,
    name: 'redemptionVaultWeb3SpaceId',
  });

  const selectedTokenVaultEntry = React.useMemo(() => {
    const selectedTokenAddress = (
      selectedRedemption?.token ?? ''
    ).toLowerCase();
    if (!selectedTokenAddress) return undefined;
    const tokenMatches = vaultsWithOwners.filter(
      (entry) => entry.vault.spaceToken.toLowerCase() === selectedTokenAddress,
    );
    if (tokenMatches.length <= 1) {
      return tokenMatches[0];
    }
    if (typeof selectedVaultWeb3SpaceId === 'number') {
      const ownerMatch = tokenMatches.find(
        (entry) => entry.owner.web3SpaceId === selectedVaultWeb3SpaceId,
      );
      if (ownerMatch) {
        return ownerMatch;
      }
    }
    return tokenMatches[0];
  }, [selectedRedemption?.token, selectedVaultWeb3SpaceId, vaultsWithOwners]);

  const selectedTokenVault = selectedTokenVaultEntry?.vault;

  React.useEffect(() => {
    if (selectedTokenVaultEntry?.owner?.web3SpaceId) {
      setValue(
        'redemptionVaultWeb3SpaceId',
        selectedTokenVaultEntry.owner.web3SpaceId,
        {
          shouldValidate: false,
          shouldDirty: false,
        },
      );
      return;
    }
    if (typeof web3SpaceId === 'number') {
      setValue('redemptionVaultWeb3SpaceId', web3SpaceId, {
        shouldValidate: false,
        shouldDirty: false,
      });
    }
  }, [selectedTokenVaultEntry?.owner?.web3SpaceId, setValue, web3SpaceId]);

  const conversionCollateralsBase =
    React.useMemo((): TokenPercentageAsset[] => {
      return (selectedTokenVault?.collaterals ?? []).map((collateral) => {
        const addr = collateral.address.toLowerCase();
        const availableInRedemptionToken =
          typeof selectedTokenVault?.redemptionPrice === 'number' &&
          selectedTokenVault.redemptionPrice > 0
            ? collateral.usdEqual / selectedTokenVault.redemptionPrice
            : undefined;
        const collateralType = treasuryTypeByTokenAddress.get(addr);
        return {
          address: collateral.address,
          icon: collateral.icon,
          symbol: collateral.symbol,
          value: collateral.value,
          usdEqual: collateral.usdEqual,
          tokenPrice: collateral.tokenPrice,
          type: collateralType ?? '',
          availableInRedemptionToken,
          redemptionTokenSymbol: selectedTokenVault?.tokenSymbol,
          space: collateral.space ?? {
            title: selectedTokenVaultEntry?.owner.title ?? spaceTitle,
            slug: selectedTokenVaultEntry?.owner.slug ?? spaceSlug,
          },
        };
      });
    }, [
      selectedTokenVault?.collaterals,
      selectedTokenVault?.redemptionPrice,
      selectedTokenVault?.tokenSymbol,
      selectedTokenVaultEntry?.owner.slug,
      selectedTokenVaultEntry?.owner.title,
      spaceSlug,
      spaceTitle,
      treasuryTypeByTokenAddress,
    ]);

  const autoPopulateSignature = React.useMemo(
    () =>
      `${selectedRedemption?.token ?? ''}|${conversionCollateralsBase
        .map((c) => `${c.address}:${c.usdEqual ?? 0}`)
        .join(',')}`,
    [selectedRedemption?.token, conversionCollateralsBase],
  );

  const lastAutoPopulateRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!selectedRedemption?.token || conversionCollateralsBase.length === 0)
      return;
    if (lastAutoPopulateRef.current === autoPopulateSignature) return;
    const autoConversions = rebalanceByUsd(
      conversionCollateralsBase.map((c) => ({
        address: c.address ?? '',
        usdEqual: c.usdEqual,
      })),
    );
    if (autoConversions.length === 0) return;
    setValue('conversions', autoConversions, {
      shouldDirty: true,
      shouldValidate: true,
    });
    lastAutoPopulateRef.current = autoPopulateSignature;
  }, [
    autoPopulateSignature,
    conversionCollateralsBase,
    selectedRedemption?.token,
    setValue,
  ]);

  React.useEffect(() => {
    if (conversionCollateralsBase.length === 0) return;

    const currentConversions = getValues('conversions');
    if (!currentConversions?.length) return;

    const allowed = new Set(
      conversionCollateralsBase.map((c) => (c.address ?? '').toLowerCase()),
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
          asset: index === 0 ? conversionCollateralsBase[0]?.address ?? '' : '',
        };
      },
    );

    if (!hasInvalid) return;

    setValue('conversions', next, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [conversionCollateralsBase, getValues, setValue]);

  const redemptionAmount = React.useMemo(() => {
    const parsed = Number(selectedRedemption?.amount ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [selectedRedemption?.amount]);

  const selectedTokenCurrencyCode = React.useMemo(() => {
    const feedAddress = (
      selectedTokenVault?.redemptionCurrencyFeed ?? USD_FEED_ADDRESS
    ).toLowerCase();
    return CURRENCY_CODE_BY_FEED[feedAddress];
  }, [selectedTokenVault?.redemptionCurrencyFeed]);

  const selectedTokenCurrencySymbol = React.useMemo(
    () => getCurrencySymbol(selectedTokenCurrencyCode),
    [selectedTokenCurrencyCode],
  );

  const { data: selectedCurrencyUsdRate = 1 } = useSWR<number>(
    selectedTokenVault?.redemptionCurrencyFeed
      ? ['redeem-currency-usd-rate', selectedTokenVault.redemptionCurrencyFeed]
      : null,
    async (key: readonly [string, string]) => {
      const [, feed] = key;
      const feedAddress = feed.toLowerCase();
      if (feedAddress === USD_FEED_ADDRESS) {
        return 1;
      }
      const [decimals, latestRoundData] = await Promise.all([
        publicClient.readContract({
          address: feed as `0x${string}`,
          abi: chainlinkPriceFeedAbi,
          functionName: 'decimals',
        }),
        publicClient.readContract({
          address: feed as `0x${string}`,
          abi: chainlinkPriceFeedAbi,
          functionName: 'latestRoundData',
        }),
      ]);
      const answer = latestRoundData[1];
      if (answer <= 0n) {
        return 1;
      }
      return Number(answer) / Math.pow(10, Number(decimals));
    },
  );

  const selectedTokenPriceInUsd = React.useMemo(() => {
    if (
      !selectedTokenVault ||
      typeof selectedTokenVault.redemptionPrice !== 'number' ||
      !Number.isFinite(selectedTokenVault.redemptionPrice)
    ) {
      return undefined;
    }
    const currencyToUsdRate =
      Number.isFinite(selectedCurrencyUsdRate) && selectedCurrencyUsdRate > 0
        ? selectedCurrencyUsdRate
        : 1;
    return selectedTokenVault.redemptionPrice * currencyToUsdRate;
  }, [selectedCurrencyUsdRate, selectedTokenVault]);

  const selectedTokenPriceHint = React.useMemo(() => {
    if (
      !selectedTokenVault ||
      typeof selectedTokenVault.redemptionPrice !== 'number' ||
      !Number.isFinite(selectedTokenVault.redemptionPrice)
    ) {
      return undefined;
    }
    return `${selectedTokenCurrencySymbol}${selectedTokenVault.redemptionPrice.toFixed(
      2,
    )}`;
  }, [selectedTokenCurrencySymbol, selectedTokenVault]);

  const selectedTokenUsdValue = React.useMemo(() => {
    if (
      typeof selectedTokenPriceInUsd !== 'number' ||
      !Number.isFinite(selectedTokenPriceInUsd)
    ) {
      return undefined;
    }
    return redemptionAmount * selectedTokenPriceInUsd;
  }, [redemptionAmount, selectedTokenPriceInUsd]);

  const selectedTreasuryBalance = React.useMemo(() => {
    if (!selectedRedemption?.token) return undefined;
    const bal = treasuryBalanceByTokenAddress.get(
      selectedRedemption.token.toLowerCase(),
    );
    return typeof bal === 'number' && Number.isFinite(bal) ? bal : undefined;
  }, [selectedRedemption?.token, treasuryBalanceByTokenAddress]);

  const isRequestedAmountExceedsTreasury = React.useMemo(() => {
    if (
      typeof selectedTreasuryBalance !== 'number' ||
      !Number.isFinite(selectedTreasuryBalance)
    ) {
      return false;
    }
    return redemptionAmount > selectedTreasuryBalance + 0.000001;
  }, [redemptionAmount, selectedTreasuryBalance]);

  const currentConversions = useWatch({
    control,
    name: 'conversions',
  }) as Array<{ asset: string; percentage: string }> | undefined;

  const selectedCollateralUsdTotal = React.useMemo(() => {
    const conversions = currentConversions ?? [];
    if (conversions.length === 0) return 0;
    return conversions.reduce((sum, conversion) => {
      const asset = conversionCollateralsBase.find(
        (collateral) =>
          collateral.address.toLowerCase() === conversion.asset.toLowerCase(),
      );
      if (!asset?.usdEqual) return sum;
      const percentage = Number(conversion.percentage ?? 0);
      if (!Number.isFinite(percentage) || percentage <= 0) return sum;
      return sum + (asset.usdEqual * percentage) / 100;
    }, 0);
  }, [conversionCollateralsBase, currentConversions]);

  const isSelectedCollateralInsufficient = React.useMemo(() => {
    if (
      typeof selectedTokenUsdValue !== 'number' ||
      !Number.isFinite(selectedTokenUsdValue)
    ) {
      return false;
    }
    return selectedCollateralUsdTotal + 0.000001 < selectedTokenUsdValue;
  }, [selectedCollateralUsdTotal, selectedTokenUsdValue]);

  const exceededCollateralAllocations = React.useMemo(() => {
    if (
      typeof selectedTokenUsdValue !== 'number' ||
      !Number.isFinite(selectedTokenUsdValue)
    ) {
      return [];
    }
    const conversions = currentConversions ?? [];
    return conversions
      .map((conversion) => {
        const asset = conversionCollateralsBase.find(
          (collateral) =>
            collateral.address.toLowerCase() === conversion.asset.toLowerCase(),
        );
        if (!asset?.usdEqual) {
          return null;
        }
        const percentage = Number(conversion.percentage ?? 0);
        if (!Number.isFinite(percentage) || percentage <= 0) {
          return null;
        }
        const requestedUsd = (selectedTokenUsdValue * percentage) / 100;
        const availableUsd = asset.usdEqual;
        if (requestedUsd <= availableUsd + 0.000001) {
          return null;
        }
        return {
          address: asset.address,
          symbol: asset.symbol,
          requestedUsd,
          availableUsd,
        };
      })
      .filter(
        (
          item,
        ): item is {
          address: string;
          symbol: string;
          requestedUsd: number;
          availableUsd: number;
        } => item !== null,
      );
  }, [conversionCollateralsBase, currentConversions, selectedTokenUsdValue]);
  const hasExceededCollateralAllocation =
    exceededCollateralAllocations.length > 0;

  const conversionAssetsWithDetails =
    React.useMemo((): TokenPercentageAsset[] => {
      const requestedByAddress = new Map<string, number>();
      for (const conversion of currentConversions ?? []) {
        const percentage = Number(conversion.percentage ?? 0);
        if (!Number.isFinite(percentage) || percentage <= 0) continue;
        const assetKey = conversion.asset.toLowerCase();
        const requestedInRedemptionCurrency =
          (redemptionAmount * percentage) / 100;
        requestedByAddress.set(
          assetKey,
          (requestedByAddress.get(assetKey) ?? 0) +
            requestedInRedemptionCurrency,
        );
      }

      return conversionCollateralsBase.map((asset) => ({
        ...asset,
        tokenPrice: asset.tokenPrice,
        priceCurrencySymbol: '$',
        requestedAmount: requestedByAddress.get(asset.address.toLowerCase()),
        requestedCurrencySymbol: selectedTokenCurrencySymbol,
      }));
    }, [
      conversionCollateralsBase,
      currentConversions,
      redemptionAmount,
      selectedTokenCurrencySymbol,
    ]);

  const blockSubmit =
    isRequestedAmountExceedsTreasury ||
    hasExceededCollateralAllocation ||
    isSelectedCollateralInsufficient;

  const blockMessage = React.useMemo(() => {
    if (isRequestedAmountExceedsTreasury && selectedRedemption?.token) {
      return tProposal('requestedExceedsTreasury', {
        amount: redemptionAmount.toFixed(2),
        balance: (selectedTreasuryBalance ?? 0).toFixed(2),
        symbol:
          redeemableTokens.find(
            (t) =>
              t.address.toLowerCase() ===
              selectedRedemption.token.toLowerCase(),
          )?.symbol ?? '',
      });
    }
    if (hasExceededCollateralAllocation || isSelectedCollateralInsufficient) {
      return tProposal('collateralInsufficient');
    }
    return undefined;
  }, [
    hasExceededCollateralAllocation,
    isRequestedAmountExceedsTreasury,
    isSelectedCollateralInsufficient,
    redeemableTokens,
    redemptionAmount,
    selectedRedemption?.token,
    selectedTreasuryBalance,
    tProposal,
  ]);

  React.useEffect(() => {
    setSubmitGuard({
      canSubmit: !blockSubmit,
      blockMessage,
    });
  }, [blockMessage, blockSubmit, setSubmitGuard]);

  return (
    <div className="flex flex-col gap-4">
      <Skeleton
        loading={isCurrentSpaceVaultsLoading || isTreasuryAssetsLoading}
        width={'100%'}
        height={90}
      >
        <TokenPayoutFieldArray
          tokens={redeemableTokens}
          name="redemptions"
          label={tProposal('redemptionAmountLabel')}
          allowAddOrRemove={false}
          showTreasuryBalanceHint
          selectedTokenPriceHint={selectedTokenPriceHint}
          isLoadingTokens={isLoadingRedeemableTokens}
          loadingTokensLabel={tExchangeStakesAndTokens('loadingTokens')}
        />
      </Skeleton>
      {isRequestedAmountExceedsTreasury && selectedRedemption?.token ? (
        <div className="text-2 text-red-11 mt-1">
          {tProposal('requestedExceedsTreasury', {
            amount: redemptionAmount.toFixed(2),
            balance: (selectedTreasuryBalance ?? 0).toFixed(2),
            symbol:
              redeemableTokens.find(
                (t) =>
                  t.address.toLowerCase() ===
                  selectedRedemption.token.toLowerCase(),
              )?.symbol ?? '',
          })}
        </div>
      ) : null}
      <Skeleton
        loading={isCurrentSpaceVaultsLoading}
        width={'100%'}
        height={90}
      >
        {selectedRedemption?.token ? (
          <TokenPercentageFieldArray
            assets={conversionAssetsWithDetails}
            name="conversions"
            label="Converted into"
            showFieldDetails
            onRemoveRebalance={(remainingAssets) => {
              const rebalanced = rebalanceByUsd(remainingAssets);
              setValue('conversions', rebalanced, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
        ) : null}
      </Skeleton>
      {(isSelectedCollateralInsufficient ||
        hasExceededCollateralAllocation) && (
        <div className="text-2 text-red-11">
          {tProposal('collateralInsufficient')}
        </div>
      )}
    </div>
  );
};
