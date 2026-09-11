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
  classifyTransferPreflight,
  extractRevertReason,
  logChainTransferError,
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
import { useTranslations } from 'next-intl';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

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

type TransferErrorDetails = {
  symbol?: string;
  balance?: number;
  creditLeft?: number;
  creditLimit?: number;
  spendable?: number;
  chainReason?: string;
  chainSelector?: string;
};

export const PeopleTransferForm = ({
  peoples,
  spaces,
  tokens,
  updateAssets,
}: PeopleTransferFormType) => {
  const tActions = useTranslations('ProfileActions');
  const tErrors = useTranslations('ProfileActions.transferFunds.form.errors');
  const { person } = useMe();
  const { fundWallet } = useFundWallet({
    address: person?.address as `0x${string}`,
  });
  const { jwt: authToken } = useJwt();
  const { transferTokens, isTransferring } = useTransferTokensMutation({
    authToken,
  });

  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [transferErrorDetails, setTransferErrorDetails] =
    useState<TransferErrorDetails | null>(null);

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

      let blocked: ReturnType<typeof classifyTransferPreflight> = {
        status: 'ok',
      };
      for (const [tokenAddress, totalAmount] of tokenTotals) {
        const asset = assets.find(
          (a) => a.address?.toLowerCase() === tokenAddress,
        );
        const balance = asset ? parseFloat(String(asset.value)) : 0;
        const result = classifyTransferPreflight({
          amount: totalAmount,
          balance,
          symbol: asset?.symbol,
          mutualCredit: asset?.mutualCredit,
        });
        if (result.status !== 'ok') {
          blocked = result;
          break;
        }
      }

      if (blocked.status === 'credit_limit') {
        setTransferErrorDetails({
          symbol: blocked.symbol,
          balance: blocked.balance,
          creditLeft: blocked.creditLeft,
          creditLimit: blocked.creditLimit,
          spendable: blocked.spendable,
        });
        form.setError('root', { message: 'credit_limit' });
        return;
      }
      if (blocked.status === 'not_credit_eligible') {
        setTransferErrorDetails({
          symbol: blocked.symbol,
          balance: blocked.balance,
        });
        form.setError('root', { message: 'not_credit_eligible' });
        return;
      }
      if (blocked.status === 'insufficient_funds') {
        setTransferErrorDetails(null);
        form.setError('root', {
          message: blocked.isHypha
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
      setTransferErrorDetails(null);
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
      const inspected = logChainTransferError('Transfer failed:', error);
      const firstToken = data.payouts?.find((payout) => payout.token)?.token;
      const failedAsset = firstToken
        ? assets.find(
            (asset) =>
              asset.address?.toLowerCase() === firstToken.toLowerCase(),
          )
        : undefined;
      const failedBalance = failedAsset
        ? parseFloat(String(failedAsset.value))
        : undefined;
      const failedCreditLeft = failedAsset?.mutualCredit?.creditLimitLeft;
      setTransferErrorDetails({
        symbol: failedAsset?.symbol,
        balance: failedBalance,
        creditLeft: failedCreditLeft,
        creditLimit: failedAsset?.mutualCredit?.creditLimit,
        spendable:
          failedBalance !== undefined
            ? failedBalance +
              (typeof failedCreditLeft === 'number' ? failedCreditLeft : 0)
            : undefined,
        chainReason: inspected.reason ?? undefined,
        chainSelector: inspected.selector ?? undefined,
      });

      let errorMessage: string = tErrors('generic');

      if (error instanceof Error) {
        if (error.message.includes('Smart wallet client not available')) {
          errorMessage = tErrors('smartWalletNotConnected');
        } else if (
          error.message.includes('ERC20: transfer amount exceeds balance')
        ) {
          errorMessage = 'insufficient_funds';
        } else if (inspected.kind === 'credit_limit') {
          errorMessage = 'credit_limit';
        } else if (inspected.kind === 'sender_not_whitelisted') {
          errorMessage = tErrors('senderNotWhitelisted');
        } else if (inspected.kind === 'recipient_not_whitelisted') {
          errorMessage = tErrors('recipientNotWhitelisted');
        } else if (inspected.kind === 'supply_exceeded') {
          errorMessage = tErrors('supplyExceeded');
        } else if (error.message.includes('Execution reverted with reason:')) {
          const match = error.message.match(
            /Execution reverted with reason: (.*?)\./,
          );
          errorMessage =
            match && match[1]
              ? extractRevertReason(match[1])
              : tErrors('contractExecutionFailed');
        } else if (error.message.includes('user rejected')) {
          errorMessage = tErrors('transactionRejected');
        } else if (inspected.reason) {
          errorMessage = inspected.reason;
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
            label={tActions('transferFunds.form.amountLabel')}
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
                {tActions('transferFunds.form.submitLabel')}
              </Button>
            )}
          </div>
          {form.formState.errors.root && (
            <div className="flex flex-col gap-1 text-2 text-foreground">
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
              ) : form.formState.errors.root.message === 'credit_limit' ? (
                tErrors('creditLimitExceeded', {
                  symbol:
                    transferErrorDetails?.symbol || tErrors('thisCurrency'),
                  spendable: formatCurrencyValue(
                    transferErrorDetails?.spendable ?? 0,
                  ),
                  creditLeft: formatCurrencyValue(
                    transferErrorDetails?.creditLeft ?? 0,
                  ),
                  creditLimit: formatCurrencyValue(
                    transferErrorDetails?.creditLimit ?? 0,
                  ),
                  balance: formatCurrencyValue(
                    transferErrorDetails?.balance ?? 0,
                  ),
                })
              ) : form.formState.errors.root.message ===
                'not_credit_eligible' ? (
                tErrors('notCreditEligible', {
                  symbol:
                    transferErrorDetails?.symbol || tErrors('thisCurrency'),
                  balance: formatCurrencyValue(
                    transferErrorDetails?.balance ?? 0,
                  ),
                })
              ) : (
                form.formState.errors.root.message
              )}
              {transferErrorDetails?.chainReason ||
              transferErrorDetails?.chainSelector ? (
                <span className="text-1 font-mono text-neutral-10">
                  {tErrors('chainRevert', {
                    reason: transferErrorDetails.chainReason || 'unknown',
                    selector: transferErrorDetails.chainSelector || '—',
                  })}
                </span>
              ) : null}
            </div>
          )}
        </form>
      </Form>
    </>
  );
};
