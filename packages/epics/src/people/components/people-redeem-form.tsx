'use client';

import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@hypha-platform/ui';
import { Separator, Button } from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import React, { useRef, useState } from 'react';
import {
  extractRevertReason,
  personRedeem,
  useMe,
  useRedeemTokensMutation,
  useSpacesBySlugs,
} from '@hypha-platform/core/client';
import {
  TokenPercentageFieldArray,
  TokenPayoutFieldArray,
} from '../../agreements';
import { useScrollToErrors } from '../../hooks';
import { useFundWallet, useVaults } from '../../treasury/hooks';
import { useJwt } from '@hypha-platform/core/client';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
  tokenPrice?: number;
  value?: number;
  space?: {
    title: string;
    slug: string;
  };
}

interface PeopleRedeemFormType {
  tokens: Token[];
  updateAssets: () => Promise<void>;
}

type FormValues = z.infer<typeof personRedeem>;

export const PeopleRedeemForm = ({
  tokens,
  updateAssets,
}: PeopleRedeemFormType) => {
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
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}`,
  });
  const { jwt: authToken } = useJwt();
  const { redeemTokens, isRedeeming } = useRedeemTokensMutation({
    authToken,
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

  const { vaults } = useVaults({
    spaceSlug: selectedRedemption?.spaceSlug,
  });
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

  const selectedTokenUsdValue = React.useMemo(() => {
    const selectedToken = tokens.find(
      (token) =>
        token.address.toLowerCase() ===
        (selectedRedemption?.token ?? '').toLowerCase(),
    );
    return typeof selectedToken?.tokenPrice === 'number'
      ? redemptionAmount * selectedToken.tokenPrice
      : undefined;
  }, [tokens, selectedRedemption?.token, redemptionAmount]);

  const selectedTokenAvailableBalance = React.useMemo(() => {
    const selectedToken = tokens.find(
      (token) =>
        token.address.toLowerCase() ===
        (selectedRedemption?.token ?? '').toLowerCase(),
    );
    return typeof selectedToken?.value === 'number' &&
      Number.isFinite(selectedToken.value)
      ? selectedToken.value
      : undefined;
  }, [tokens, selectedRedemption?.token]);

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
      return sum + (asset.usdEqual * percentage) / 100;
    }, 0);
  }, [conversionAssets, currentConversions]);

  const isSelectedCollateralInsufficient = React.useMemo(() => {
    if (
      typeof selectedTokenUsdValue !== 'number' ||
      !Number.isFinite(selectedTokenUsdValue)
    ) {
      return false;
    }
    return selectedCollateralUsdTotal + 0.000001 < selectedTokenUsdValue;
  }, [selectedCollateralUsdTotal, selectedTokenUsdValue]);

  React.useEffect(() => {
    const currentConversions = form.getValues('conversions');
    if (!currentConversions?.length) return;

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
  const tokenSlugs = React.useMemo(() => {
    return tokens
      .filter((token) => token.space?.slug)
      .map((token) => token.space?.slug!);
  }, [tokens]);
  const { spaces } = useSpacesBySlugs(tokenSlugs);

  useScrollToErrors(form, formRef);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleRedeem = async (data: FormValues) => {
    try {
      const [redemption] = data.redemptions;
      if (!redemption) {
        form.setError('root', {
          message: 'No redemption data found. Please fill in the form.',
        });
        return;
      }
      const spaceSlug = redemption.spaceSlug;
      if (!spaceSlug) {
        form.setError('root', {
          message: 'Please select a space for redemption.',
        });
        return;
      }
      const space = spaces?.find((space) => space.slug === spaceSlug);
      if (!space?.web3SpaceId) {
        form.setError('root', {
          message: 'Selected space is not configured for redemption.',
        });
        return;
      }
      if (isRequestedAmountExceedsBalance) {
        form.setError('root', {
          message:
            'Requested redemption amount exceeds your available token balance. Reduce the amount and try again.',
        });
        return;
      }
      if (isSelectedCollateralInsufficient) {
        form.setError('root', {
          message:
            'Selected collateral allocation is below redemption token value. Increase collateral coverage before redeeming.',
        });
        return;
      }
      const redeemInput = {
        redemption: {
          web3SpaceId: space.web3SpaceId,
          token: redemption.token,
          amount: redemption.amount,
        },
        conversions: data.conversions,
      };
      const result = await redeemTokens(redeemInput);
      console.log('Redeem hashes:', result);

      setShowSuccessMessage(true);
      timeoutRef.current = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      form.reset();
      try {
        await updateAssets();
      } catch (error) {
        console.error('Failed to refresh assets:', error);
      }
    } catch (error) {
      console.error('Redeem failed:', error);
      let errorMessage: string =
        'An error occurred while processing your redeem. Please try again.';

      if (error instanceof Error) {
        if (error.message.includes('Smart wallet client not available')) {
          errorMessage =
            'Smart wallet is not connected. Please connect your wallet and try again.';
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
              : 'Contract execution failed.';
        } else if (error.message.includes('user rejected')) {
          errorMessage =
            'Transaction was rejected. Please approve the transaction to proceed.';
        }
      }
      form.setError('root', { message: errorMessage });
    }
  };

  const handleInvalid = (error: any) => {
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
            label="Redemption Amount"
            tokens={tokens}
            name="redemptions"
            allowAddOrRemove={false}
          />
          <TokenPercentageFieldArray
            label="Converted into"
            assets={conversionAssets}
            name="conversions"
            onRemoveRebalance={(remainingAssets) => {
              const rebalanced = rebalanceByUsd(remainingAssets);
              form.setValue('conversions', rebalanced, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
          />
          {isSelectedCollateralInsufficient && (
            <div className="text-2 text-red-11">
              Selected collateral coverage ($
              {selectedCollateralUsdTotal.toFixed(2)}) is below redemption value
              (${(selectedTokenUsdValue ?? 0).toFixed(2)}).
            </div>
          )}
          {isRequestedAmountExceedsBalance && (
            <div className="text-2 text-red-11">
              Requested amount ({redemptionAmount.toFixed(2)}) exceeds available
              balance ({(selectedTokenAvailableBalance ?? 0).toFixed(2)}).
            </div>
          )}
          <Separator />
          <div className="flex gap-2 justify-end">
            {isRedeeming ? (
              <div className="flex items-center gap-2 text-sm text-neutral-10">
                <Loader2 className="animate-spin w-4 h-4" />
                Redeeming
              </div>
            ) : showSuccessMessage ? (
              <div className="text-green-600 text-sm font-medium">
                Your redeem has been successfully completed!
              </div>
            ) : (
              <Button type="submit" disabled={isRedeeming}>
                Redeem
              </Button>
            )}
          </div>
          {form.formState.errors.root && (
            <div className="text-2 text-foreground">
              {form.formState.errors.root.message === 'insufficient_funds' ? (
                <>
                  Your wallet balance is insufficient to complete this
                  transaction. Please{' '}
                  <span
                    onClick={fundWallet}
                    className="font-bold cursor-pointer text-accent-9 underline"
                  >
                    top up your account
                  </span>{' '}
                  to proceed.
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
