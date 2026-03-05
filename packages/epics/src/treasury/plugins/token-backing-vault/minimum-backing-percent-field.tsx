'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Input,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export function MinimumBackingPercentField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.minimumBackingPercent"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full">
              Minimum Backing %
            </span>
            <FormControl className="w-full">
              <Input
                type="number"
                min={0}
                max={100}
                className="w-full"
                {...field}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? 0 : Number(e.target.value),
                  )
                }
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
