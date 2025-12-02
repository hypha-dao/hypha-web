'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  Input,
  FormMessage,
  RequirementMark,
} from '@hypha-platform/ui';

export const TokenPriceField = () => {
  const { control } = useFormContext();
  const enableTokenPrice = useWatch({
    control,
    name: 'enableTokenPrice',
    defaultValue: false,
  });

  return (
    <FormField
      control={control}
      name="tokenPrice"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full justify-between">
            <div className="flex gap-1 w-full">
              <span className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                Token Price
              </span>
              {enableTokenPrice && <RequirementMark className="text-2" />}
            </div>
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
