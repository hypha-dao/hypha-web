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
  extractRevertReason,
  Person,
  personRedeem,
  useMe,
  useRedeemTokensMutation,
} from '@hypha-platform/core/client';
import {
  TokenPercentageFieldArray,
  TokenPayoutFieldArray,
} from '../../agreements';
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
      memo: undefined,
    },
  });

  const { assets } = useUserAssets({
    personSlug: person?.slug,
  });

  useScrollToErrors(form, formRef);

  const { lang } = useParams();

  const handleRedeem = async (data: FormValues) => {
    try {
      // Check balance (optional)
      // For now, we'll skip balance check as redeem may have different logic
      // TODO: Adapt to redeem contract function when available
      const redeemInput = {
        redemptions: data.redemptions.map((r) => ({
          token: r.token,
          amount: r.amount,
        })),
        conversions: data.conversions,
        memo: data.memo,
      };
      const result = await redeemTokens(redeemInput);
      console.log('Redeem hashes:', result);
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

  return (
    <>
      <Form {...form}>
        <form
          ref={formRef}
          onSubmit={form.handleSubmit(handleRedeem)}
          className="flex flex-col gap-5"
        >
          <TokenPayoutFieldArray
            label="Redemption Amount"
            tokens={tokens}
            name="redemptions"
          />
          <TokenPercentageFieldArray
            label="Converted into"
            assets={assets}
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
