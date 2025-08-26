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
import { Asterisk as AsteriskIcon } from 'lucide-react';

export function TokenIconField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="iconUrl"
      rules={{ required: 'Please upload a token icon' }}
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11">
              Token Icon
              <AsteriskIcon className="text-destructive inline w-4 h-4 align-super" />
            </FormLabel>
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
