'use client';

import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Separator,
  Button,
  RequirementMark,
  Input,
} from '@hypha-platform/ui';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { useSmartWallets } from '@privy-io/react-auth/smart-wallets';
import {
  TOKENS,
  publicClient,
  useBuySpaceTokensMutation,
  useMe,
  type TokenType,
  spaceTokenPurchaseAbi,
} from '@hypha-platform/core/client';
import { useScrollToErrors } from '../../hooks';
import { useDbTokens } from '../../hooks/use-db-tokens';
import { useDbSpaces } from '../../hooks';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { Loader2 } from 'lucide-react';
import { formatUnits } from 'viem';
import { RecipientField } from '../../agreements/plugins/components/common/recipient-field';
import { TokenSelectDropdown } from '../../agreements/plugins/components/common/token-select-dropdown';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

type PurchasableToken = {
  id: number;
  spaceId: number;
  name: string;
  symbol: string;
  address?: string;
  referencePrice?: number | null;
  referenceCurrency?: string | null;
  iconUrl?: string | null;
  maxSupply: number;
  type: string;
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

interface PeopleBuySpaceTokensProps {
  personSlug: string;
  closeUrl: string;
}

export const PeopleBuySpaceTokens = ({
  personSlug: _personSlug,
  closeUrl,
}: PeopleBuySpaceTokensProps) => {
  const t = useTranslations('PeopleBuySpaceTokens');
  const router = useRouter();
  const { person } = useMe();
  const { client } = useSmartWallets();
  const { tokens: dbTokens, isLoading: isTokensLoading } = useDbTokens();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const eligibilityAddress = ((
    client as { account?: { address?: `0x${string}` } } | null
  )?.account?.address ?? person?.address) as `0x${string}` | undefined;

  const availableTokens = useMemo<PurchasableToken[]>(
    () =>
      (dbTokens as PurchasableToken[]).filter(
        (tok) => tok.type !== 'voice' && Boolean(tok.address),
      ),
    [dbTokens],
  );
  const tokenAddresses = useMemo(
    () => availableTokens.map((tok) => tok.address as `0x${string}`),
    [availableTokens],
  );

  const {
    data: eligibleTokenAddressSet,
    isLoading: isLoadingEligibility,
    error: eligibilityError,
  } = useSWR(
    eligibilityAddress && tokenAddresses.length > 0
      ? ['eligibleSpaceTokens', eligibilityAddress, ...tokenAddresses]
      : null,
    async () => {
      const settled = await Promise.allSettled(
        tokenAddresses.map(async (address) => {
          const [
            [salePaymentToken, salePricePerToken, tokensLeftToSell],
            canBuy,
          ] = await Promise.all([
            publicClient.readContract({
              address,
              abi: spaceTokenPurchaseAbi,
              functionName: 'getTokenSaleDetails',
            }),
            publicClient.readContract({
              address,
              abi: spaceTokenPurchaseAbi,
              functionName: 'canAccountPurchase',
              args: [eligibilityAddress as `0x${string}`],
            }),
          ]);

          const isSaleActive =
            salePaymentToken !== ZERO_ADDRESS &&
            salePricePerToken > 0n &&
            tokensLeftToSell > 0n;

          return {
            address: address.toLowerCase(),
            eligible: isSaleActive && canBuy,
          };
        }),
      );

      const results: { address: string; eligible: boolean }[] = [];
      let firstRejection: unknown;

      settled.forEach((r, i) => {
        const addr = tokenAddresses[i]?.toLowerCase() ?? '';
        if (r.status === 'fulfilled') {
          results.push(r.value);
        } else {
          if (firstRejection === undefined) firstRejection = r.reason;
          results.push({ address: addr, eligible: false });
        }
      });

      const rejectionCount = settled.filter(
        (r) => r.status === 'rejected',
      ).length;
      if (rejectionCount > 0 && rejectionCount === settled.length) {
        throw firstRejection instanceof Error
          ? firstRejection
          : new Error(String(firstRejection));
      }

      return new Set(
        results.filter((item) => item.eligible).map((item) => item.address),
      );
    },
    { revalidateOnFocus: true },
  );

  const purchasableTokens = useMemo<PurchasableToken[]>(
    () =>
      availableTokens.filter((token) =>
        eligibleTokenAddressSet?.has(token.address?.toLowerCase() ?? ''),
      ),
    [availableTokens, eligibleTokenAddressSet],
  );

  const { spaces } = useDbSpaces({
    parentOnly: false,
  });

  const spaceById = useMemo(() => {
    const m = new Map<number, { slug: string; title: string }>();
    for (const s of spaces ?? []) {
      m.set(s.id, { slug: s.slug, title: s.title });
    }
    return m;
  }, [spaces]);

  const purchasableDropdownTokens = useMemo(
    () =>
      purchasableTokens
        .filter((tok) => tok.address)
        .map((tok) => {
          const sp = spaceById.get(tok.spaceId);
          return {
            address: tok.address as string,
            symbol: tok.symbol,
            iconUrl: tok.iconUrl || '/placeholder/token-icon.svg',
            type: tok.type as TokenType,
            spaceSubtitle: sp?.slug ?? sp?.title,
          };
        }),
    [purchasableTokens, spaceById],
  );

  const buySpaceTokensSchema = useMemo(
    () =>
      z.object({
        tokenAddress: z.string().min(1, t('validation.tokenRequired')),
        amount: z
          .string()
          .min(1, t('validation.amountRequired'))
          .refine((v) => parseFloat(v) > 0, {
            message: t('validation.amountPositive'),
          }),
        buyerAddress: z.string().optional(),
        paymentRecipient: z.string().optional(),
      }),
    [t],
  );

  type FormValues = z.infer<typeof buySpaceTokensSchema>;

  const formRef = useRef<HTMLFormElement>(null);
  const resolver = useMemo(
    () => zodResolver(buySpaceTokensSchema),
    [buySpaceTokensSchema],
  );

  const form = useForm<FormValues>({
    resolver,
    defaultValues: {
      tokenAddress: '',
      amount: '',
      buyerAddress: person?.address ?? '',
      paymentRecipient: '',
    },
  });

  useScrollToErrors(form, formRef);

  const tokenAddress = useWatch({
    control: form.control,
    name: 'tokenAddress',
  });
  const amount = useWatch({ control: form.control, name: 'amount' });
  const parsedAmount = Number(amount);

  const selectedToken = purchasableTokens.find(
    (tok) => tok.address?.toLowerCase() === tokenAddress?.toLowerCase(),
  );

  const {
    sale,
    needsApproval,
    hasEnoughBalance,
    approve,
    buy,
    isApproving,
    isBuying,
    approveError,
    buyError,
    reset,
    isLoadingSale,
    buyerAddress,
  } = useBuySpaceTokensMutation({
    tokenAddress: tokenAddress ? (tokenAddress as `0x${string}`) : undefined,
    amount,
  });

  const paymentTokenMeta = useMemo(
    () =>
      TOKENS.find(
        (token) =>
          token.address?.toLowerCase() === sale?.salePaymentToken.toLowerCase(),
      ),
    [sale?.salePaymentToken],
  );

  const totalCost = useMemo(() => {
    if (!sale || sale.paymentAmount <= 0n) return 0;
    return Number(formatUnits(sale.paymentAmount, sale.paymentTokenDecimals));
  }, [sale]);

  const remainingForSale = useMemo(() => {
    if (!sale) return '0';
    return formatUnits(sale.tokensLeftToSell, 18);
  }, [sale]);

  const salePricePerToken = useMemo(() => {
    if (!sale) return 0;
    return Number(
      formatUnits(sale.salePricePerToken, sale.paymentTokenDecimals),
    );
  }, [sale]);

  const buyerMembers = useMemo(
    () => (person?.address ? [person] : []),
    [person],
  );
  const recipientSpaces = useMemo(
    () =>
      spaces?.filter(
        (space) =>
          sale?.executor &&
          space.address?.toLowerCase() === sale.executor.toLowerCase(),
      ) ?? [],
    [sale?.executor, spaces],
  );

  useEffect(() => {
    if (buyerAddress || person?.address) {
      form.setValue('buyerAddress', buyerAddress ?? person?.address ?? '', {
        shouldDirty: false,
      });
    }
    if (sale?.executor) {
      form.setValue('paymentRecipient', sale.executor, {
        shouldDirty: false,
      });
    }
  }, [buyerAddress, person?.address, sale?.executor, form]);

  const handlePurchase = async (_data: FormValues) => {
    setIsSubmitting(true);
    form.clearErrors('root');
    try {
      if (needsApproval) {
        await approve();
      }
      await buy();
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
        router.push(closeUrl);
      }, 3000);
      form.setValue('amount', '');
      reset();
    } catch (error) {
      console.error('Purchase failed', error);
      const message =
        error instanceof Error ? error.message : t('purchaseFailedGeneric');
      form.setError('root', {
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (eligibilityError && !isLoadingEligibility) {
    return (
      <div className="text-2 text-neutral-11">{t('eligibilityLoadError')}</div>
    );
  }

  if (
    !isTokensLoading &&
    !isLoadingEligibility &&
    purchasableTokens.length === 0
  ) {
    return <div className="text-2 text-neutral-11">{t('empty')}</div>;
  }

  return (
    <Form {...form}>
      <form
        ref={formRef}
        onSubmit={form.handleSubmit(handlePurchase)}
        className="flex flex-col gap-5"
      >
        <Separator />

        <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
          <div className="flex gap-1">
            <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
              {t('selectToken')}
            </label>
            <RequirementMark className="text-2" />
          </div>
          <div className="flex flex-col gap-2 grow min-w-0">
            <FormField
              control={form.control}
              name="tokenAddress"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <TokenSelectDropdown
                      value={field.value}
                      onValueChange={field.onChange}
                      tokens={purchasableDropdownTokens}
                      placeholder={t('selectPlaceholder')}
                      disabled={
                        isTokensLoading ||
                        purchasableDropdownTokens.length === 0
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
          <div className="flex gap-1">
            <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
              {t('amount')}
            </label>
            <RequirementMark className="text-2" />
          </div>
          <div className="flex flex-col gap-2 grow min-w-0">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {selectedToken && !isNaN(parsedAmount) && parsedAmount > 0 && sale && (
          <div className="text-sm text-neutral-11">
            <div>
              {t('pricePerToken', {
                price: formatCurrencyValue(salePricePerToken),
                currency:
                  paymentTokenMeta?.symbol ?? t('fallbackPaymentSymbol'),
              })}
            </div>
            <div>
              {t('totalCost', {
                amount: formatCurrencyValue(totalCost),
                currency: paymentTokenMeta?.symbol ?? '',
              })}
            </div>
            <div>{t('remainingInSale', { amount: remainingForSale })}</div>
          </div>
        )}

        {selectedToken && isLoadingSale && (
          <div className="text-sm text-neutral-11 flex items-center gap-2">
            <Loader2 className="animate-spin w-4 h-4" />
            {t('loadingSale')}
          </div>
        )}

        {selectedToken && !isLoadingSale && !sale && (
          <div className="text-sm text-neutral-11">{t('unableToReadSale')}</div>
        )}

        {selectedToken &&
          sale &&
          sale.salePaymentToken ===
            '0x0000000000000000000000000000000000000000' && (
            <div className="text-sm text-neutral-11">{t('saleDisabled')}</div>
          )}

        <Separator />

        <RecipientField
          label={t('recipientTokenSent', {
            symbol: selectedToken?.symbol ?? t('fallbackTokenSymbol'),
          })}
          members={buyerMembers}
          defaultRecipientType="member"
          readOnly={true}
          showTabs={false}
          name="buyerAddress"
        />

        <Separator />

        <RecipientField
          label={t('recipientPaymentPaid', {
            symbol: paymentTokenMeta?.symbol ?? t('fallbackPaymentSymbol'),
          })}
          members={[]}
          spaces={recipientSpaces}
          defaultRecipientType="space"
          readOnly={true}
          showTabs={false}
          name="paymentRecipient"
        />

        <Separator />

        <div className="flex gap-2 justify-end">
          {isSubmitting || isApproving || isBuying ? (
            <div className="flex items-center gap-2 text-sm text-neutral-10">
              <Loader2 className="animate-spin w-4 h-4" />
              {isApproving
                ? t('statusApproving')
                : isBuying
                ? t('statusPurchasing')
                : t('statusProcessing')}
            </div>
          ) : showSuccessMessage ? (
            <div className="text-2 font-medium text-foreground">
              {t('success')}
            </div>
          ) : (
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !selectedToken ||
                !sale ||
                sale.salePaymentToken ===
                  '0x0000000000000000000000000000000000000000' ||
                sale.salePricePerToken <= 0n ||
                !sale.canPurchase ||
                sale.tokenAmount <= 0n ||
                sale.tokensLeftToSell < sale.tokenAmount ||
                !hasEnoughBalance
              }
            >
              {t('buy')}
            </Button>
          )}
        </div>

        {form.formState.errors.root && (
          <div className="text-2 text-foreground">
            {form.formState.errors.root.message}
          </div>
        )}
        {(approveError || buyError) && (
          <div className="text-2 text-foreground">
            {(approveError || buyError)?.message ?? t('transactionFailed')}
          </div>
        )}
      </form>
    </Form>
  );
};
