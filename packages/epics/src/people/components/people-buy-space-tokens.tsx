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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMe } from '@hypha-platform/core/client';
import { useScrollToErrors } from '../../hooks';
import { useDbTokens } from '../../hooks/use-db-tokens';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { Loader2 } from 'lucide-react';

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
});

type FormValues = z.infer<typeof buySpaceTokensSchema>;

interface PeopleBuySpaceTokensProps {
  personSlug: string;
}

export const PeopleBuySpaceTokens = ({
  personSlug: _personSlug,
}: PeopleBuySpaceTokensProps) => {
  const { person } = useMe();
  const { tokens: dbTokens, isLoading: isTokensLoading } = useDbTokens();
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const purchasableTokens = useMemo<PurchasableToken[]>(
    () =>
      (dbTokens as PurchasableToken[]).filter(
        (t) =>
          t.type !== 'voice' &&
          t.address &&
          t.referencePrice != null &&
          t.referencePrice > 0,
      ),
    [dbTokens],
  );

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(buySpaceTokensSchema),
    defaultValues: {
      tokenAddress: '',
      amount: '',
    },
  });

  useScrollToErrors(form, formRef);

  const tokenAddress = useWatch({
    control: form.control,
    name: 'tokenAddress',
  });
  const amount = useWatch({ control: form.control, name: 'amount' });

  const selectedToken = purchasableTokens.find(
    (t) => t.address?.toLowerCase() === tokenAddress?.toLowerCase(),
  );

  const parsedAmount = parseFloat(amount);
  const totalCost =
    selectedToken?.referencePrice && !isNaN(parsedAmount)
      ? parsedAmount * selectedToken.referencePrice
      : 0;

  const handlePurchase = async (_data: FormValues) => {
    setIsSubmitting(true);
    try {
      // TODO: call purchaseTokens(amount) on the token contract once
      // RegularSpaceToken is upgraded with purchase functionality.
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
      form.reset();
    } catch (error) {
      console.error('Purchase failed:', error);
      form.setError('root', {
        message:
          'An error occurred while processing your purchase. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isTokensLoading && purchasableTokens.length === 0) {
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
                                {sel.name} ({sel.symbol}) —{' '}
                                {formatCurrencyValue(sel.referencePrice ?? 0)}{' '}
                                {sel.referenceCurrency ?? 'USD'} each
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
                                {t.name} ({t.symbol}) —{' '}
                                {formatCurrencyValue(t.referencePrice ?? 0)}{' '}
                                {t.referenceCurrency ?? 'USD'} each
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

        {selectedToken && !isNaN(parsedAmount) && parsedAmount > 0 && (
          <div className="text-sm text-neutral-11">
            Total cost:{' '}
            <strong>
              {formatCurrencyValue(totalCost)}{' '}
              {selectedToken.referenceCurrency ?? 'USD'}
            </strong>
          </div>
        )}

        <Separator />

        {/* Token sent to (buyer) */}
        <div className="flex flex-col gap-2">
          <span className="text-2 text-neutral-11">Token sent to</span>
          <div className="flex items-center gap-2 p-2 rounded-md bg-neutral-2 border border-neutral-6">
            <span className="text-2 text-neutral-11 font-medium truncate">
              {person?.name
                ? `${person.name}${person.surname ? ` ${person.surname}` : ''}`
                : person?.address ?? '—'}
            </span>
            {person?.address && (
              <span className="text-1 text-neutral-10 truncate">
                {person.address}
              </span>
            )}
          </div>
        </div>

        <Separator />

        {/* Payment sent to (space treasury) */}
        <div className="flex flex-col gap-2">
          <span className="text-2 text-neutral-11">Payment sent to</span>
          <div className="flex items-center gap-2 p-2 rounded-md bg-neutral-2 border border-neutral-6">
            {selectedToken ? (
              <span className="text-2 text-neutral-11 font-medium">
                {selectedToken.name} Space Treasury
              </span>
            ) : (
              <span className="text-2 text-neutral-10 italic">
                Select a token to see the treasury address
              </span>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex gap-2 justify-end">
          {isSubmitting ? (
            <div className="flex items-center gap-2 text-sm text-neutral-10">
              <Loader2 className="animate-spin w-4 h-4" />
              Purchasing
            </div>
          ) : showSuccessMessage ? (
            <div className="text-2 font-medium text-foreground">
              Your purchase was successful. Tokens will appear in your wallet
              shortly.
            </div>
          ) : (
            <Button type="submit" disabled={isSubmitting || !selectedToken}>
              Buy
            </Button>
          )}
        </div>

        {form.formState.errors.root && (
          <div className="text-2 text-foreground">
            {form.formState.errors.root.message}
          </div>
        )}
      </form>
    </Form>
  );
};
