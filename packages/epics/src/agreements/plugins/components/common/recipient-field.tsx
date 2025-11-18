'use client';

import { useFormContext } from 'react-hook-form';
import { Recipient, RecipientType } from './recipient';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Textarea,
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
  withMemoField = false,
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
  withMemoField?: boolean;
}) {
  const { control } = useFormContext();
  return (
    <>
      <FormField
        control={control}
        name={name}
        render={({ field: { value, onChange } }) => (
          <FormItem>
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
      {withMemoField && (
        <FormField
          control={control}
          name="memo"
          render={({ field }) => (
            <FormItem>
              <label className="text-2 text-neutral-11">Memo (Optional)</label>
              <FormControl>
                <Textarea
                  {...field}
                  placeholder="Add any relevant notes or details about this transaction"
                  value={field.value || ''}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </>
  );
}
