'use client';

import { useFormContext } from 'react-hook-form';
import { Recipient } from './recipient';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import { Space } from '@hypha-platform/core/client';

type Recipient = {
  name: string;
  surname: string;
  avatarUrl: string;
  address: string;
};

export function RecipientField({
  members,
  subspaces,
}: {
  members: Recipient[];
  subspaces?: Space[];
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name="recipient"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Recipient
              onChange={(recipient) => {
                field.onChange(recipient.address);
              }}
              members={members}
              subspaces={subspaces}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
