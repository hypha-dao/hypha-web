'use client';

import {
  useUserAssets,
  RecipientField,
  type Token,
  useFundWallet,
  useScrollToErrors,
} from '@hypha-platform/epics';
import { useForm, useWatch } from 'react-hook-form';
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
  RequirementMark,
} from '@hypha-platform/ui';
import { Loader2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  extractRevertReason,
  Space,
  TOKENS,
  useInvestInHyphaMutation,
  useMe,
} from '@hypha-platform/core/client';
import { TokenPayoutField } from '../../agreements/plugins/components/common/token-payout-field';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { purchaseSchema } from '../hooks/validation';

interface PeoplePurchaseHyphaTokensProps {
  personSlug: string;
  spaces: Space[];
}

const HYPHA_PRICE_USD = 0.25;
const PAYMENT_TOKEN = TOKENS.find((t) => t.symbol === 'USDC');
const RECIPIENT_SPACE_ADDRESS = '0x3dEf11d005F8C85c93e3374B28fcC69B25a650Af';

const schema = purchaseSchema.extend({ buyer: z.string() });
type FormValues = z.infer<typeof schema>;

export const PeoplePurchaseHyphaTokens = ({
  personSlug,
  spaces,
}: PeoplePurchaseHyphaTokensProps) => {
  const { person, isLoading: isPersonLoading } = useMe();
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

  const buyerMember = useMemo(() => {
    return !isPersonLoading && person ? [person] : [];
  }, [isPersonLoading, person]);
  const recipientSpace =
    spaces?.filter((s) => s?.address === RECIPIENT_SPACE_ADDRESS) || [];

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      payout: {
        amount: '',
        token: PAYMENT_TOKEN?.address ?? '',
      },
      recipient: RECIPIENT_SPACE_ADDRESS,
      buyer: person && person.address ? person.address : '',
    },
  });

  useScrollToErrors(form, formRef);

  useEffect(() => {
    if (person?.address) {
      form.setValue('buyer', person.address);
    }
  }, [form, person]);

  const amount = useWatch({
    control: form.control,
    name: 'payout.amount',
  });

  const parsedAmount = parseFloat(amount);
  const calculatedHypha = !isNaN(parsedAmount)
    ? parsedAmount / HYPHA_PRICE_USD
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
      await manualUpdate();
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
        ref={formRef}
        onSubmit={form.handleSubmit(handlePurchase)}
        className="flex flex-col gap-5"
      >
        <div className="flex flex-col gap-5 w-full">
          <Separator />
          <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
            <div className="flex gap-1">
              <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                Purchase Amount
              </label>
              <RequirementMark className="text-2" />
            </div>
            <div className="flex flex-col gap-2 grow min-w-0">
              <div className="flex md:justify-end">
                <FormField
                  control={form.control}
                  name="payout.amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <TokenPayoutField
                          value={form.getValues('payout')}
                          onChange={(val) => form.setValue('payout', val)}
                          tokens={tokens}
                          readOnlyDropdown={true}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
          <div className="text-sm text-neutral-500">
            You will receive {formatCurrencyValue(calculatedHypha)} HYPHA tokens
            (1 HYPHA = {formatCurrencyValue(HYPHA_PRICE_USD)} USD)
          </div>
          <Separator />
          <RecipientField
            label="HYPHA sent to"
            members={buyerMember}
            defaultRecipientType="member"
            readOnly={true}
            showTabs={false}
            name="buyer"
          />
          <Separator />
          <RecipientField
            label="USDC paid to"
            members={[]}
            spaces={recipientSpace}
            defaultRecipientType="space"
            readOnly={true}
            showTabs={false}
          />
        </div>
        <Separator />
        <div className="flex gap-2 justify-end">
          {isInvesting ? (
            <div className="flex items-center gap-2 text-sm text-neutral-10">
              <Loader2 className="animate-spin w-4 h-4" />
              Purchasing
            </div>
          ) : showSuccessMessage ? (
            <div className="text-2 font-medium text-foreground">
              You’ve successfully purchased your Hypha tokens. They will appear
              in your wallet account within a few seconds.
            </div>
          ) : (
            <Button type="submit" disabled={isInvesting}>
              Buy
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
