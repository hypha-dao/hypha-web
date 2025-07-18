'use client';

import { RecipientField, TokenPayoutFieldArray } from '@hypha-platform/epics';
import { useForm } from 'react-hook-form';
import {
  Person,
  personTransfer,
  useTransferTokensMutation,
} from '../../../../core/src/people';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@hypha-platform/ui';
import { Separator, Button } from '@hypha-platform/ui';
import { Space } from '../../../../core/src/space';
import { Loader2 } from 'lucide-react';

interface Token {
  icon: string;
  symbol: string;
  address: `0x${string}`;
}

interface PeopleTransferFormType {
  peoples: Person[];
  spaces: Space[];
  tokens: Token[];
}

type FormValues = z.infer<typeof personTransfer>;

export const PeopleTransferForm = ({
  peoples,
  spaces,
  tokens,
}: PeopleTransferFormType) => {
  const { transferTokens, isTransferring, transferHashes, transferError } =
    useTransferTokensMutation();

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
    },
  });

  const handleTransfer = async (data: FormValues) => {
    try {
      if (!data.recipient) {
        throw new Error('Recipient is required.');
      }

      const transferInput = {
        recipient: data.recipient,
        payouts:
          data.payouts?.map((payout) => ({
            amount: payout.amount?.toString() ?? '0',
            token: payout.token ?? '',
          })) ?? [],
      };
      const result = await transferTokens(transferInput);
      console.log('Transfer hashes:', result);
    } catch (error) {
      console.error('Transfer failed:', error);
    }
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleTransfer)}
          className="flex flex-col gap-5"
        >
          <RecipientField members={peoples} subspaces={spaces} />
          <Separator />
          <TokenPayoutFieldArray tokens={tokens} name="payouts" />
          <Separator />
          <div className="flex gap-2 justify-end">
            {isTransferring ? (
              <div className="flex items-center gap-2 text-sm text-neutral-10">
                <Loader2 className="animate-spin w-4 h-4" />
                Transferring
              </div>
            ) : (
              <Button type="submit" disabled={isTransferring}>
                Transfer
              </Button>
            )}
          </div>
          {transferError && (
            <div className="text-red-500">Error: {transferError.message}</div>
          )}
          {transferHashes && (
            <div>
              Transfers completed:
              <ul>
                {transferHashes.map(({ token, txHash }) => (
                  <li key={txHash}>
                    Token {token}: {txHash}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </Form>
    </>
  );
};
