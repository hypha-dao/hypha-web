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
  readOnly,
  emptyMembersMessage,
  emptySpacesMessage,
  label,
  showTabs,
  name = 'recipient',
}: {
  members: Person[];
  spaces?: Space[];
  defaultRecipientType?: RecipientType;
  readOnly?: boolean;
  emptyMembersMessage?: string;
  emptySpacesMessage?: string;
  label?: string;
  showTabs?: boolean;
  name?: string;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <FormItem>
          {/* @ts-expect-error Server Component */}
          <FormControl>
            <Recipient
              value={value}
              onChange={(recipient) => {
                onChange(recipient.address);
              }}
              members={members}
              spaces={spaces}
              defaultRecipientType={defaultRecipientType}
              readOnly={readOnly}
              emptyMembersMessage={emptyMembersMessage}
              emptySpacesMessage={emptySpacesMessage}
              label={label}
              showTabs={showTabs}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
