'use client';

import { type SubmitErrorHandler, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@hypha-platform/ui';
import { Separator, Button } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  CURRENCY_FEED_OPTIONS,
  extractRevertReason,
  personRedeem,
  publicClient,
  useJwt,
  useMe,
  useRedeemTokensMutation,
} from '@hypha-platform/core/client';
import {
  TokenPercentageFieldArray,
  TokenPayoutFieldArray,
} from '../../agreements';
import { useScrollToErrors } from '../../hooks';
import { useFundWallet, useVaults } from '../../treasury/hooks';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';

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

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  tokenPrice?: number;
  tokenCurrency?: string;
  value?: number;
  space?: {
    title: string;
    slug: string;
    web3SpaceId?: number;
  };
}

interface PeopleRedeemFormType {
  tokens: Token[];
  updateAssets: () => Promise<void>;
  isLoadingTokens?: boolean;
}

type TouchedConversion = {
  asset?: boolean;
  percentage?: boolean;
};

type ConversionAssetDetail = {
  address: string;
  icon: string;
  symbol: string;
  value?: number;
  usdEqual?: number;
  tokenPrice?: number;
  priceCurrencySymbol?: string;
  requestedAmount?: number;
  requestedCurrencySymbol?: string;
  type?: string | null;
  space?: {
    title: string;
    slug?: string;
  };
};

type FormValues = z.infer<typeof personRedeem>;

export const PeopleRedeemForm = ({
  tokens,
  updateAssets,
  isLoadingTokens = false,
}: PeopleRedeemFormType) => {
  const t = useTranslations('ProfileActions.redeemTokens');
  const PERCENT_SCALE = 100;
  const PERCENT_BASE = 100 * PERCENT_SCALE; // 100.00%
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

  const { person } = useMe();
  const router = useRouter();
  const { lang, personSlug } = useParams<{
    lang: string;
    personSlug: string;
  }>();
  const closePanelUrl = useMemo(
    () => `/${lang}/profile/${personSlug}`,
    [lang, personSlug],
  );
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}`,
  });
  const { jwt: authToken } = useJwt();
  const { redeemTokens, isRedeeming } = useRedeemTokensMutation({
    authToken,
    smartWalletAddress: person?.address as `0x${string}` | undefined,
  });

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(personRedeem),
    defaultValues: {
      redemptions: [
        {
          spaceSlug: '',
          amount: '',
          token: '',
        },
      ],
      conversions: [
        {
          percentage: '100.00',
          asset: '',
        },
      ],
    },
  });

  const redemptions = useWatch({
    control: form.control,
    name: 'redemptions',
  });
  const selectedRedemption = redemptions?.[0];

  const { vaults, isLoading: vaultsLoading } = useVaults({
    spaceSlug: selectedRedemption?.spaceSlug,
  });

  const isCollateralsLoading = Boolean(
    selectedRedemption?.token && selectedRedemption?.spaceSlug && vaultsLoading,
  );
  const selectedTokenVault = React.useMemo(
    () =>
      vaults.find(
        (vault) =>
          vault.spaceToken.toLowerCase() ===
          selectedRedemption?.token?.toLowerCase(),
      ),
    [vaults, selectedRedemption?.token],
  );

  const conversionAssets = React.useMemo(
    () =>
      (selectedTokenVault?.collaterals ?? []).map((collateral) => {
        const availableInRedemptionToken =
          typeof selectedTokenVault?.redemptionPrice === 'number' &&
          selectedTokenVault.redemptionPrice > 0
            ? collateral.usdEqual / selectedTokenVault.redemptionPrice
            : undefined;
        return {
          address: collateral.address,
          icon: collateral.icon,
          symbol: collateral.symbol,
          value: collateral.value,
          usdEqual: collateral.usdEqual,
          tokenPrice: collateral.tokenPrice,
          availableInRedemptionToken,
          redemptionTokenSymbol: selectedTokenVault?.tokenSymbol,
          space: collateral.space,
        };
      }),
    [
      selectedTokenVault?.collaterals,
      selectedTokenVault?.redemptionPrice,
      selectedTokenVault?.tokenSymbol,
    ],
  );

  const autoPopulateSignature = React.useMemo(
    () =>
      `${selectedRedemption?.token ?? ''}|${
        selectedRedemption?.spaceSlug ?? ''
      }|${conversionAssets
        .map((asset) => `${asset.address}:${asset.usdEqual ?? 0}`)
        .join(',')}`,
    [
      selectedRedemption?.token,
      selectedRedemption?.spaceSlug,
      conversionAssets,
    ],
  );

  const lastAutoPopulateRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!selectedRedemption?.token || conversionAssets.length === 0) return;
    if (lastAutoPopulateRef.current === autoPopulateSignature) return;
    const autoConversions = rebalanceByUsd(conversionAssets);
    if (autoConversions.length === 0) return;
    form.setValue('conversions', autoConversions, {
      shouldDirty: true,
      shouldValidate: true,
    });
    lastAutoPopulateRef.current = autoPopulateSignature;
  }, [
    autoPopulateSignature,
    conversionAssets,
    form,
    selectedRedemption?.token,
  ]);

  const redemptionAmount = React.useMemo(() => {
    const parsed = Number(selectedRedemption?.amount ?? 0);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [selectedRedemption?.amount]);

  const selectedToken = React.useMemo(
    () =>
      tokens.find(
        (token) =>
          token.address.toLowerCase() ===
          (selectedRedemption?.token ?? '').toLowerCase(),
      ),
    [tokens, selectedRedemption?.token],
  );

  const selectedTokenCurrencyCode = React.useMemo(() => {
    const feedAddress = (
      selectedTokenVault?.redemptionCurrencyFeed ?? USD_FEED_ADDRESS
    ).toLowerCase();
    return CURRENCY_CODE_BY_FEED[feedAddress] ?? selectedToken?.tokenCurrency;
  }, [
    selectedToken?.tokenCurrency,
    selectedTokenVault?.redemptionCurrencyFeed,
  ]);

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
      !selectedToken ||
      typeof selectedToken.tokenPrice !== 'number' ||
      !Number.isFinite(selectedToken.tokenPrice)
    ) {
      return undefined;
    }
    const currencyToUsdRate =
      Number.isFinite(selectedCurrencyUsdRate) && selectedCurrencyUsdRate > 0
        ? selectedCurrencyUsdRate
        : 1;
    return selectedToken.tokenPrice * currencyToUsdRate;
  }, [selectedCurrencyUsdRate, selectedToken]);

  const selectedTokenPriceHint = React.useMemo(() => {
    if (
      !selectedToken ||
      typeof selectedToken.tokenPrice !== 'number' ||
      !Number.isFinite(selectedToken.tokenPrice)
    ) {
      return undefined;
    }
    return `${selectedTokenCurrencySymbol}${selectedToken.tokenPrice.toFixed(
      2,
    )}`;
  }, [selectedToken, selectedTokenCurrencySymbol]);

  const selectedTokenUsdValue = React.useMemo(() => {
    if (
      typeof selectedTokenPriceInUsd !== 'number' ||
      !Number.isFinite(selectedTokenPriceInUsd)
    ) {
      return undefined;
    }
    return redemptionAmount * selectedTokenPriceInUsd;
  }, [redemptionAmount, selectedTokenPriceInUsd]);

  const selectedTokenAvailableBalance = React.useMemo(
    () =>
      typeof selectedToken?.value === 'number' &&
      Number.isFinite(selectedToken.value)
        ? selectedToken.value
        : undefined,
    [selectedToken],
  );

  const isRequestedAmountExceedsBalance = React.useMemo(() => {
    if (
      typeof selectedTokenAvailableBalance !== 'number' ||
      !Number.isFinite(selectedTokenAvailableBalance)
    ) {
      return false;
    }
    return redemptionAmount > selectedTokenAvailableBalance + 0.000001;
  }, [redemptionAmount, selectedTokenAvailableBalance]);

  const currentConversions = useWatch({
    control: form.control,
    name: 'conversions',
  }) as FormValues['conversions'] | undefined;

  const selectedCollateralUsdTotal = React.useMemo(() => {
    if (
      typeof selectedTokenUsdValue !== 'number' ||
      !Number.isFinite(selectedTokenUsdValue)
    ) {
      return 0;
    }
    const conversions = currentConversions ?? [];
    if (conversions.length === 0) return 0;
    return conversions.reduce((sum, conversion) => {
      const asset = conversionAssets.find(
        (collateral) =>
          collateral.address.toLowerCase() === conversion.asset.toLowerCase(),
      );
      if (!asset?.usdEqual) return sum;
      const percentage = Number(conversion.percentage ?? 0);
      if (!Number.isFinite(percentage) || percentage <= 0) return sum;
      const requiredUsd = (selectedTokenUsdValue * percentage) / 100;
      return sum + Math.min(asset.usdEqual, requiredUsd);
    }, 0);
  }, [conversionAssets, currentConversions, selectedTokenUsdValue]);

  const isSelectedCollateralInsufficient = React.useMemo(() => {
    if (isCollateralsLoading) {
      return false;
    }
    if (
      typeof selectedTokenUsdValue !== 'number' ||
      !Number.isFinite(selectedTokenUsdValue)
    ) {
      return false;
    }
    return selectedCollateralUsdTotal + 0.000001 < selectedTokenUsdValue;
  }, [isCollateralsLoading, selectedCollateralUsdTotal, selectedTokenUsdValue]);

  const exceededCollateralAllocations = React.useMemo(() => {
    if (isCollateralsLoading) {
      return [];
    }
    if (
      typeof selectedTokenUsdValue !== 'number' ||
      !Number.isFinite(selectedTokenUsdValue)
    ) {
      return [];
    }
    const conversions = currentConversions ?? [];
    return conversions
      .map((conversion) => {
        const asset = conversionAssets.find(
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
  }, [
    conversionAssets,
    currentConversions,
    isCollateralsLoading,
    selectedTokenUsdValue,
  ]);
  const hasExceededCollateralAllocation =
    exceededCollateralAllocations.length > 0;

  const conversionAssetsWithDetails = React.useMemo(() => {
    const requestedByAddress = new Map<string, number>();
    for (const conversion of currentConversions ?? []) {
      const percentage = Number(conversion.percentage ?? 0);
      if (!Number.isFinite(percentage) || percentage <= 0) continue;
      const assetKey = conversion.asset.toLowerCase();
      const requestedInRedemptionCurrency =
        (redemptionAmount * percentage) / 100;
      requestedByAddress.set(
        assetKey,
        (requestedByAddress.get(assetKey) ?? 0) + requestedInRedemptionCurrency,
      );
    }

    return conversionAssets.map(
      (asset): ConversionAssetDetail => ({
        ...asset,
        tokenPrice: asset.tokenPrice,
        priceCurrencySymbol: '$',
        requestedAmount: requestedByAddress.get(asset.address.toLowerCase()),
        requestedCurrencySymbol: selectedTokenCurrencySymbol,
      }),
    );
  }, [
    conversionAssets,
    currentConversions,
    redemptionAmount,
    selectedTokenCurrencySymbol,
  ]);

  const shouldShowEmptyConversionFieldMessage = React.useMemo(() => {
    const conversions = currentConversions ?? [];
    const touchedConversions = (form.formState.touchedFields.conversions ??
      []) as TouchedConversion[];

    return conversions.some((conversion, index) => {
      const touched = touchedConversions[index];
      const isAssetTouched = Boolean(touched?.asset);
      const isPercentageTouched = Boolean(touched?.percentage);
      if (!isAssetTouched && !isPercentageTouched) {
        return false;
      }
      const hasAsset = conversion.asset.trim().length > 0;
      const hasPercentage = conversion.percentage.trim().length > 0;
      return !hasAsset || !hasPercentage;
    });
  }, [currentConversions, form.formState.touchedFields.conversions]);

  React.useEffect(() => {
    const currentConversions = form.getValues('conversions');
    if (!currentConversions?.length) return;
    if (conversionAssets.length === 0) return;

    const allowedAssets = new Set(
      conversionAssets.map((asset) => asset.address.toLowerCase()),
    );

    let hasInvalidAsset = false;
    const nextConversions = currentConversions.map((conversion, index) => {
      if (allowedAssets.has(conversion.asset.toLowerCase())) {
        return conversion;
      }
      hasInvalidAsset = true;
      return {
        ...conversion,
        asset: index === 0 ? conversionAssets[0]?.address ?? '' : '',
      };
    });

    if (!hasInvalidAsset) return;

    form.setValue('conversions', nextConversions, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [conversionAssets, form]);
  useScrollToErrors(form, formRef);

  const closePanelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  React.useEffect(() => {
    return () => {
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
      }
    };
  }, []);

  const handleRedeem = async (data: FormValues) => {
    setShowSuccessMessage(false);
    if (isCollateralsLoading) {
      return;
    }
    try {
      const [redemption] = data.redemptions;
      if (!redemption) {
        form.setError('root', {
          message: t('form.errors.noRedemptionData'),
        });
        return;
      }
      const spaceSlug = redemption.spaceSlug;
      if (!spaceSlug) {
        form.setError('root', {
          message: t('form.errors.selectSpace'),
        });
        return;
      }
      const redemptionSpaceWeb3Id = selectedToken?.space?.web3SpaceId;
      if (typeof redemptionSpaceWeb3Id !== 'number') {
        form.setError('root', {
          message: t('form.errors.spaceNotConfigured'),
        });
        return;
      }
      if (isRequestedAmountExceedsBalance) {
        form.setError('root', {
          message: t('form.errors.exceedsBalance'),
        });
        return;
      }
      if (hasExceededCollateralAllocation || isSelectedCollateralInsufficient) {
        form.setError('root', {
          message: t('form.errors.collateralExceeded'),
        });
        return;
      }
      const redeemInput = {
        redemption: {
          web3SpaceId: redemptionSpaceWeb3Id,
          token: redemption.token,
          amount: redemption.amount,
        },
        conversions: data.conversions,
      };
      const result = await redeemTokens(redeemInput);
      console.log('Redeem hashes:', result);

      setShowSuccessMessage(true);
      if (closePanelTimeoutRef.current) {
        clearTimeout(closePanelTimeoutRef.current);
      }
      closePanelTimeoutRef.current = setTimeout(() => {
        router.replace(closePanelUrl, { scroll: false });
      }, 3000);
      // Keep form values visible with the success message until the panel closes.
      try {
        await updateAssets();
      } catch (error) {
        console.error('Failed to refresh assets:', error);
      }
    } catch (error) {
      console.error('Redeem failed:', error);
      let errorMessage: string = t('form.errors.generic');

      if (error instanceof Error) {
        if (error.message.includes('Smart wallet client not available')) {
          errorMessage = t('form.errors.smartWalletNotConnected');
        } else if (
          error.message.includes('ERC20: transfer amount exceeds balance')
        ) {
          errorMessage = 'insufficient_funds';
        } else if (error.message.includes('Execution reverted with reason:')) {
          const match = error.message.match(
            /Execution reverted with reason: (.*?)\./,
          );
          errorMessage =
            match && match[1]
              ? extractRevertReason(match[1])
              : t('form.errors.contractFailed');
        } else if (error.message.includes('user rejected')) {
          errorMessage = t('form.errors.transactionRejected');
        }
      }
      form.setError('root', { message: errorMessage });
    }
  };

  const handleInvalid: SubmitErrorHandler<FormValues> = (error) => {
    console.error(error);
  };

  return (
    <>
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleRedeem, handleInvalid)}
          className="flex flex-col gap-5"
        >
          <TokenPayoutFieldArray
            label={t('form.redemptionAmountLabel')}
            tokens={tokens}
            name="redemptions"
            allowAddOrRemove={false}
            showSelectedTokenBalanceHint
            selectedTokenPriceHint={selectedTokenPriceHint}
            isLoadingTokens={isLoadingTokens}
            loadingTokensLabel="Loading tokens..."
          />
          {isRequestedAmountExceedsBalance && (
            <div className="text-2 text-red-11 mt-1">
              {t('form.requestedExceedsBalance', {
                amount: redemptionAmount.toFixed(2),
                balance: (selectedTokenAvailableBalance ?? 0).toFixed(2),
              })}
            </div>
          )}
          {selectedRedemption?.token &&
            (isCollateralsLoading ? (
              <div className="flex items-center gap-2 text-sm text-neutral-10 py-2">
                <Loader2 className="animate-spin w-4 h-4 shrink-0" />
                {t('form.loadingCollaterals')}
              </div>
            ) : (
              <TokenPercentageFieldArray
                label={t('form.convertedIntoLabel')}
                assets={conversionAssetsWithDetails}
                name="conversions"
                showEmptyFieldMessage={shouldShowEmptyConversionFieldMessage}
                showFieldDetails
                onRemoveRebalance={(remainingAssets) => {
                  const rebalanced = rebalanceByUsd(remainingAssets);
                  form.setValue('conversions', rebalanced, {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
              />
            ))}
          {(isSelectedCollateralInsufficient ||
            hasExceededCollateralAllocation) && (
            <div className="text-2 text-red-11">
              {t('form.collateralInsufficient')}
            </div>
          )}
          <Separator />
          <div className="flex gap-2 justify-end">
            {isRedeeming ? (
              <div className="flex items-center gap-2 text-sm text-neutral-10">
                <Loader2 className="animate-spin w-4 h-4" />
                {t('form.redeeming')}
              </div>
            ) : showSuccessMessage ? (
              <div className="text-green-600 text-sm font-medium">
                {t('form.successMessage')}
              </div>
            ) : (
              <Button
                type="submit"
                disabled={isRedeeming || isCollateralsLoading}
              >
                {t('form.redeem')}
              </Button>
            )}
          </div>
          {form.formState.errors.root && (
            <div className="text-2 text-foreground">
              {form.formState.errors.root.message === 'insufficient_funds' ? (
                <>
                  {t('form.insufficientFundsLead')}{' '}
                  <button
                    type="button"
                    onClick={fundWallet}
                    className="font-bold cursor-pointer text-accent-9 underline bg-transparent border-0 p-0"
                  >
                    {t('form.insufficientFundsTopUp')}
                  </button>{' '}
                  {t('form.insufficientFundsTrail')}
                </>
              ) : (
                form.formState.errors.root.message
              )}
            </div>
          )}
        </form>
      </Form>
    </>
  );
};
