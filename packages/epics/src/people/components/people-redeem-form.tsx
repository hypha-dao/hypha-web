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
          />
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
