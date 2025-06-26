'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import { EntryMethod } from './entry-method';
import { EntryMethodType } from '@core/governance';

export function EntryMethodField({
  value,
  onChange,
}: {
  value?: any;
  onChange?: (selected: EntryMethodType) => void;
}) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name="entryMethod"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <EntryMethod onChange={onChange} value={field.value ?? value} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
