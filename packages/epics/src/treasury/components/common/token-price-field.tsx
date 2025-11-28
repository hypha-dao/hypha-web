'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  Input,
  FormMessage,
} from '@hypha-platform/ui';

export const TokenPriceField = () => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenPrice"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full justify-between">
            <span className="text-2 text-neutral-11 w-full">Token Price</span>
            <FormControl>
              <Input type="number" placeholder="Enter token price" {...field} />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
