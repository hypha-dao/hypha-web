'use client';

import { useFormContext } from 'react-hook-form';
import { Recipient, RecipientType } from './recipient';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import { Space, Person } from '@hypha-platform/core/client';

export function RecipientField({
  members,
  spaces,
  defaultRecipientType = 'member',
}: {
  members: Person[];
  spaces?: Space[];
  defaultRecipientType?: RecipientType;
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
              spaces={spaces}
              defaultRecipientType={defaultRecipientType}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
