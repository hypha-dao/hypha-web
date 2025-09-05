'use client';

import { useUserAssets } from '@hypha-platform/epics';
import { useForm, useWatch } from 'react-hook-form';
import { useInvestInHyphaMutation } from '../../../../core/src/people';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Separator,
  Button,
} from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { TOKENS } from '@hypha-platform/core/client';
import { TokenPayoutField } from '../../agreements/plugins/components/common/token-payout-field';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
}

interface PeoplePurchaseHyphaTokensProps {
  personSlug: string;
}

const EXCHANGE_RATE = 0.25;
const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');

const purchaseSchema = z.object({
  payout: z.object({
    amount: z.string().min(1, 'Amount is required'),
    token: z.string(),
  }),
});

type FormValues = z.infer<typeof purchaseSchema>;

export const PeoplePurchaseHyphaTokens = ({
  personSlug,
}: PeoplePurchaseHyphaTokensProps) => {
  const { manualUpdate } = useUserAssets({
    personSlug,
    refreshInterval: 10000,
  });

  const { investInHypha, isInvesting, investError } =
    useInvestInHyphaMutation();

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const tokens: Token[] = PAYMENT_TOKEN
    ? [
        {
          icon: PAYMENT_TOKEN.icon,
          symbol: PAYMENT_TOKEN.symbol,
          address: PAYMENT_TOKEN.address as `0x${string}`,
        },
      ]
    : [];

  const form = useForm<FormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      payout: {
        amount: '',
        token: PAYMENT_TOKEN?.address ?? '',
      },
    },
  });

  const amount = useWatch({
    control: form.control,
    name: 'payout.amount',
  });

  const parsedAmount = parseFloat(amount);
  const calculatedHypha = !isNaN(parsedAmount)
    ? parsedAmount / EXCHANGE_RATE
    : 0;

  const handlePurchase = async (data: FormValues) => {
    try {
      if (data.payout.token !== PAYMENT_TOKEN?.address) {
        throw new Error('Invalid token.');
      }

      const usdcAmount = data.payout.amount;
      const result = await investInHypha({ usdcAmount });
      console.log('Purchase hash:', result);
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      form.reset();
      manualUpdate();
    } catch (error) {
      console.error('Purchase failed:', error);
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handlePurchase)}
          className="flex flex-col gap-5"
        >
          <div className="flex flex-col gap-2 w-full">
            <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
              <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                Purchase Amount
              </label>
              <div className="flex flex-col gap-2 grow min-w-0">
                <div className="flex md:justify-end">
                  <FormField
                    control={form.control}
                    name="payout"
                    render={({ field: { value, onChange } }) => (
                      <FormItem>
                        <FormControl>
                          <TokenPayoutField
                            value={value}
                            onChange={onChange}
                            tokens={tokens}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="text-sm text-neutral-500">
            You will receive {formatCurrencyValue(calculatedHypha)} HYPHA tokens
            (1 HYPHA = 0.25 USDC)
          </div>
          <Separator />
          <div className="flex gap-2 justify-end">
            {isInvesting ? (
              <div className="flex items-center gap-2 text-sm text-neutral-10">
                <Loader2 className="animate-spin w-4 h-4" />
                Purchasing
              </div>
            ) : showSuccessMessage ? (
              <div className="text-green-600 text-sm font-medium">
                Purchase completed!
              </div>
            ) : (
              <Button type="submit" disabled={isInvesting}>
                Purchase
              </Button>
            )}
          </div>
          {investError ? (
            <div className="text-error text-2">{investError}</div>
          ) : null}
        </form>
      </Form>
    </>
  );
};
