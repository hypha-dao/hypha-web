'use client';

import { RecipientField, TokenPayoutFieldArray } from '@hypha-platform/epics';
import { useForm } from 'react-hook-form';
import { Person, personTransfer } from '../../../../core/src/people';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@hypha-platform/ui';
import { Separator, Button } from '@hypha-platform/ui';
import { Space } from '../../../../core/src/space';

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
    console.log(data);
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
          <div className="flex justify-end w-full">
            <Button type="submit">Transfer</Button>
          </div>
        </form>
      </Form>
    </>
  );
};
