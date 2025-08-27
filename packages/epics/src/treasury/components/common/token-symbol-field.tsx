'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RequirementMark,
} from '@hypha-platform/ui';

export function TokenSymbolField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="symbol"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full gap-1">
              Token Symbol <RequirementMark className="text-2" />
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
