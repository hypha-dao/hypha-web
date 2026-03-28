'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Separator,
  Button,
  RequirementMark,
  Input,
  Image,
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
} from '@hypha-platform/core/client';
import { useScrollToErrors } from '../../hooks';
import { useDbTokens } from '../../hooks/use-db-tokens';
import { useDbSpaces } from '../../hooks';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { Loader2 } from 'lucide-react';
import { formatUnits } from 'viem';
import { RecipientField } from '../../agreements/plugins/components/common/recipient-field';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type PurchasableToken = {
  id: number;
  name: string;
  symbol: string;
  address?: string;
  referencePrice?: number | null;
  referenceCurrency?: string | null;
  iconUrl?: string | null;
  maxSupply: number;
  type: string;
};

const buySpaceTokensSchema = z.object({
  tokenAddress: z.string().min(1, 'Please select a token'),
  amount: z
    .string()
    .min(1, 'Please enter an amount')
    .refine((v) => parseFloat(v) > 0, {
      message: 'Amount must be greater than 0',
    }),
  buyerAddress: z.string().optional(),
  paymentRecipient: z.string().optional(),
});

type FormValues = z.infer<typeof buySpaceTokensSchema>;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const spaceTokenPurchaseAbi = [
  {
    type: 'function',
    inputs: [],
    name: 'getTokenSaleDetails',
    outputs: [
      { name: 'salePaymentToken', internalType: 'address', type: 'address' },
      { name: 'salePricePerToken', internalType: 'uint256', type: 'uint256' },
      { name: 'tokensLeftToSell', internalType: 'uint256', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    inputs: [{ name: 'account', internalType: 'address', type: 'address' }],
    name: 'canAccountPurchase',
    outputs: [{ name: '', internalType: 'bool', type: 'bool' }],
    stateMutability: 'view',
  },
] as const;

interface PeopleBuySpaceTokensProps {
  personSlug: string;
  closeUrl: string;
}

export const PeopleBuySpaceTokens = ({
  personSlug: _personSlug,
  closeUrl,
}: PeopleBuySpaceTokensProps) => {
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
        (t) => t.type !== 'voice' && Boolean(t.address),
      ),
    [dbTokens],
  );
  const tokenAddresses = useMemo(
    () => availableTokens.map((t) => t.address as `0x${string}`),
    [availableTokens],
  );

  const { data: eligibleTokenAddressSet, isLoading: isLoadingEligibility } =
    useSWR(
      eligibilityAddress && tokenAddresses.length > 0
        ? ['eligibleSpaceTokens', eligibilityAddress, ...tokenAddresses]
        : null,
      async () => {
        const results = await Promise.all(
          tokenAddresses.map(async (address) => {
            try {
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
            } catch {
              return { address: address.toLowerCase(), eligible: false };
            }
          }),
        );

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

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(buySpaceTokensSchema),
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
    (t) => t.address?.toLowerCase() === tokenAddress?.toLowerCase(),
  );

  const {
    sale,
    hasEnoughBalance,
    buy,
    isApproving,
    isBuying,
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
  const { spaces } = useDbSpaces({
    parentOnly: false,
  });
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
        error instanceof Error
          ? error.message
          : 'An error occurred while processing your purchase. Please try again.';
      form.setError('root', {
        message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (
    !isTokensLoading &&
    !isLoadingEligibility &&
    purchasableTokens.length === 0
  ) {
    return (
      <div className="text-2 text-neutral-11">
        No space tokens are currently available for purchase.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        ref={formRef}
        onSubmit={form.handleSubmit(handlePurchase)}
        className="flex flex-col gap-5"
      >
        <Separator />

        {/* Token selector */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
          <div className="flex gap-1">
            <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
              Select Token
            </label>
            <RequirementMark className="text-2" />
          </div>
          <div className="flex flex-col gap-2 grow min-w-0">
            <FormField
              control={form.control}
              name="tokenAddress"
              render={({ field }) => {
                const sel = purchasableTokens.find(
                  (t) =>
                    t.address?.toLowerCase() === field.value?.toLowerCase(),
                );
                return (
                  <FormItem>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isTokensLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a token">
                            {sel && (
                              <div className="flex items-center gap-2">
                                <Image
                                  src={
                                    sel.iconUrl || '/placeholder/token-icon.svg'
                                  }
                                  width={20}
                                  height={20}
                                  alt={sel.symbol}
                                  className="rounded-full h-5 w-5 shrink-0"
                                />
                                {sel.name} ({sel.symbol})
                              </div>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {purchasableTokens.map((t) => (
                            <SelectItem key={t.address} value={t.address ?? ''}>
                              <div className="flex items-center gap-2">
                                <Image
                                  src={
                                    t.iconUrl || '/placeholder/token-icon.svg'
                                  }
                                  width={20}
                                  height={20}
                                  alt={t.symbol}
                                  className="rounded-full h-5 w-5 shrink-0"
                                />
                                {t.name} ({t.symbol})
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
          </div>
        </div>

        {/* Amount input */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
          <div className="flex gap-1">
            <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
              Amount
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
              Price:{' '}
              <strong>
                {formatCurrencyValue(salePricePerToken)}{' '}
                {paymentTokenMeta?.symbol ?? 'PAYMENT'} per token
              </strong>
            </div>
            <div>
              Total cost:{' '}
              <strong>
                {formatCurrencyValue(totalCost)}{' '}
                {paymentTokenMeta?.symbol ?? ''}
              </strong>
            </div>
            <div>
              Remaining in sale: <strong>{remainingForSale}</strong>
            </div>
          </div>
        )}

        {selectedToken && isLoadingSale && (
          <div className="text-sm text-neutral-11 flex items-center gap-2">
            <Loader2 className="animate-spin w-4 h-4" />
            Loading sale config...
          </div>
        )}

        {selectedToken && !isLoadingSale && !sale && (
          <div className="text-sm text-neutral-11">
            Unable to read token sale configuration.
          </div>
        )}

        {selectedToken &&
          sale &&
          sale.salePaymentToken ===
            '0x0000000000000000000000000000000000000000' && (
            <div className="text-sm text-neutral-11">
              Sale is currently disabled for this token.
            </div>
          )}

        <Separator />

        <RecipientField
          label={`${selectedToken?.symbol ?? 'Token'} sent to`}
          members={buyerMembers}
          defaultRecipientType="member"
          readOnly={true}
          showTabs={false}
          name="buyerAddress"
        />

        <Separator />

        <RecipientField
          label={`${paymentTokenMeta?.symbol ?? 'Payment'} paid to`}
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
                ? 'Approving'
                : isBuying
                ? 'Purchasing'
                : 'Processing'}
            </div>
          ) : showSuccessMessage ? (
            <div className="text-2 font-medium text-foreground">
              Your purchase was successful. Tokens will appear in your wallet
              shortly.
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
              Buy
            </Button>
          )}
        </div>

        {form.formState.errors.root && (
          <div className="text-2 text-foreground">
            {form.formState.errors.root.message}
          </div>
        )}
        {buyError && (
          <div className="text-2 text-foreground">
            {buyError.message ?? 'Transaction failed. Please retry.'}
          </div>
        )}
      </form>
    </Form>
  );
};
