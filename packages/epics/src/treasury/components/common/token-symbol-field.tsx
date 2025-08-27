'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@hypha-platform/ui';
import { AsteriskIcon } from 'lucide-react';

export function TokenSymbolField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="symbol"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full">
              Token Symbol
              <AsteriskIcon className="text-destructive inline w-4 h-4 align-super" />
            </FormLabel>
            <FormControl>
              <Input placeholder="Type a symbol" {...field} />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
