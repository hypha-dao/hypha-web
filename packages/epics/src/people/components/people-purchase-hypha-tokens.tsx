'use client';

import { useUserAssets, RecipientField } from '@hypha-platform/epics';
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
import { Space, TOKENS } from '@hypha-platform/core/client';
import { TokenPayoutField } from '../../agreements/plugins/components/common/token-payout-field';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useFundWallet } from '@hypha-platform/epics';
import { useMe } from '../../../../core/src/people';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
}

interface PeoplePurchaseHyphaTokensProps {
  personSlug: string;
  spaces: Space[];
}

const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const EXCHANGE_RATE = 0.25;
const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');
const RECIPIENT_SPACE_ADDRESS = '0x3dEf11d005F8C85c93e3374B28fcC69B25a650Af';

const purchaseSchema = z.object({
  payout: z.object({
    amount: z.string().min(1, 'Amount is required'),
    token: z.string(),
  }),
  recipient: z
    .string()
    .min(1, { message: 'Please add a recipient or wallet address' })
    .regex(ETH_ADDRESS_REGEX, { message: 'Invalid Ethereum address' }),
});

type FormValues = z.infer<typeof purchaseSchema>;

export const PeoplePurchaseHyphaTokens = ({
  personSlug,
  spaces,
}: PeoplePurchaseHyphaTokensProps) => {
  const { person } = useMe();
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}`,
  });
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

  const recipientSpace =
    spaces?.filter((s) => s?.address === RECIPIENT_SPACE_ADDRESS) || [];

  const form = useForm<FormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      payout: {
        amount: '',
        token: PAYMENT_TOKEN?.address ?? '',
      },
      recipient: RECIPIENT_SPACE_ADDRESS,
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
      if (!PAYMENT_TOKEN?.address) {
        form.setError('root', { message: 'Payment token is not configured.' });
        return;
      }
      if (data.payout.token !== PAYMENT_TOKEN.address) {
        form.setError('payout.token', { message: 'Invalid token selected.' });
        return;
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
      let errorMessage: string =
        'An error occurred while processing your purchase. Please try again.';

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
            match && match[1] ? match[1] : 'Contract execution failed.';
        } else if (error.message.includes('user rejected')) {
          errorMessage =
            'Transaction was rejected. Please approve the transaction to proceed.';
        }
      }
      form.setError('root', { message: errorMessage });
    }
  };

  if (!spaces || spaces.length === 0) {
    return (
      <div className="text-error text-sm">
        No valid spaces available. Please try again later.
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handlePurchase)}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-5 w-full">
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
          <RecipientField
            members={[]}
            spaces={recipientSpace}
            defaultRecipientType="space"
            readOnly={true}
          />
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
            <div className="text-sm font-medium text-success">
              You’ve successfully purchased your Hypha tokens. They will appear
              in your wallet account within a few seconds.
            </div>
          ) : (
            <Button type="submit" disabled={isInvesting}>
              Purchase
            </Button>
          )}
        </div>
        {form.formState.errors.root && (
          <div className="text-2">
            {form.formState.errors.root.message === 'insufficient_funds' ? (
              <>
                Your wallet balance is insufficient to complete this
                transaction. Please{' '}
                <span onClick={fundWallet} className="font-bold cursor-pointer">
                  top up your account with USDC
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
  );
};
