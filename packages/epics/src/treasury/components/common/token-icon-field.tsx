'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@hypha-platform/ui';
import { TokenIconUpload } from './token-icon';

export function TokenIconField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="iconUrl"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11">Token Icon</FormLabel>
            <FormControl>
              <TokenIconUpload
                defaultImage={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
