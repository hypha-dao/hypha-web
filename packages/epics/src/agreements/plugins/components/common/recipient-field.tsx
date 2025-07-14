'use client';

import { useFormContext } from 'react-hook-form';
import { Recipient } from './recipient';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import { Space } from '@core/space';

export function RecipientField({
  members,
  subspaces,
}: {
  members: any[];
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
