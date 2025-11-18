'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@hypha-platform/ui';
import { Separator, Button } from '@hypha-platform/ui';
import { Space } from '../../../../core/src/space';
import { Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  Person,
  personTransfer,
  useMe,
  useTransferTokensMutation,
} from '@hypha-platform/core/client';
import { RecipientField, TokenPayoutFieldArray } from '../../agreements';
import { useScrollToErrors } from '../../hooks';
import { useFundWallet } from '../../treasury/hooks';
import { useJwt } from '@hypha-platform/core/client';
import { useUserAssets } from '../../treasury/hooks';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
}

interface PeopleTransferFormType {
  peoples: Person[];
  spaces: Space[];
  tokens: Token[];
  updateAssets: () => Promise<void>;
}

type FormValues = z.infer<typeof personTransfer>;

export const PeopleTransferForm = ({
  peoples,
  spaces,
  tokens,
  updateAssets,
}: PeopleTransferFormType) => {
  const { person } = useMe();
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}`,
  });
  const { jwt: authToken } = useJwt();
  const { transferTokens, isTransferring } = useTransferTokensMutation({
    authToken,
  });

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(personTransfer),
    defaultValues: {
      recipient: '',
      payouts: [
        {
          amount: undefined,
          token: undefined,
        },
      ],
      memo: undefined,
    },
  });

  const { assets } = useUserAssets({
    personSlug: person?.slug,
  });

  useScrollToErrors(form, formRef);

  const { lang } = useParams();

  const handleTransfer = async (data: FormValues) => {
    try {
      if (!data.recipient) {
        throw new Error('Recipient is required.');
      }

      const tokenTotals = new Map<string, number>();
      data.payouts?.forEach((payout) => {
        if (payout.token && payout.amount !== undefined) {
          const lowerToken = payout.token.toLowerCase();
          const amountNum = parseFloat(String(payout.amount));
          if (isNaN(amountNum)) {
            return;
          }
          const currentTotal = tokenTotals.get(lowerToken) || 0;
          tokenTotals.set(lowerToken, currentTotal + amountNum);
        }
      });

      let hasInsufficientFunds = false;
      let isHyphaInsufficient = false;
      tokenTotals.forEach((totalAmount, tokenAddress) => {
        const asset = assets.find(
          (a) => a.address.toLowerCase() === tokenAddress,
        );
        const balance = asset ? parseFloat(String(asset.value)) : 0;
        if (totalAmount > balance) {
          hasInsufficientFunds = true;
          if (asset?.symbol === 'HYPHA') {
            isHyphaInsufficient = true;
          }
        }
      });

      if (hasInsufficientFunds) {
        form.setError('root', {
          message: isHyphaInsufficient
            ? 'insufficient_hypha'
            : 'insufficient_funds',
        });
        return;
      }

      const transferInput = {
        recipient: data.recipient,
        payouts:
          data.payouts?.map((payout) => ({
            amount: payout.amount?.toString() ?? '0',
            token: payout.token ?? '',
          })) ?? [],
        memo: data.memo,
      };
      const result = await transferTokens(transferInput);
      console.log('Transfer hashes:', result);
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
      form.reset();
      try {
        await updateAssets();
      } catch (error) {
        console.error('Failed to refresh assets:', error);
      }
    } catch (error) {
      console.error('Transfer failed:', error);
      let errorMessage: string =
        'An error occurred while processing your transfer. Please try again.';

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

  return (
    <>
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleTransfer)}
          className="flex flex-col gap-5"
        >
          <RecipientField
            members={peoples}
            spaces={spaces}
            withMemoField={true}
          />
          <Separator />
          <TokenPayoutFieldArray
            label="Amount"
            tokens={tokens}
            name="payouts"
          />
          <Separator />
          <div className="flex gap-2 justify-end">
            {isTransferring ? (
              <div className="flex items-center gap-2 text-sm text-neutral-10">
                <Loader2 className="animate-spin w-4 h-4" />
                Transferring
              </div>
            ) : showSuccessMessage ? (
              <div className="text-green-600 text-sm font-medium">
                Your transfer has been successfully completed!
              </div>
            ) : (
              <Button type="submit" disabled={isTransferring}>
                Transfer
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
              ) : form.formState.errors.root.message ===
                'insufficient_hypha' ? (
                <>
                  Your wallet balance is insufficient to complete this
                  transaction. Please{' '}
                  <Link
                    href={`/${lang}/profile/${person?.slug}/actions/purchase-hypha-tokens`}
                    className="font-bold cursor-pointer text-accent-9 underline"
                  >
                    top up your account with HYPHA
                  </Link>{' '}
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
