'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Input,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export function TokenPriceField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.tokenPrice"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full">
              Token Price
            </span>
            <FormControl className="w-full">
              <Input
                type="number"
                step="0.01"
                placeholder="Leave blank for token contract price"
                className="w-full"
                {...field}
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
