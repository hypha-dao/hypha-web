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

export function TokenDigitsField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="digits"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full">
              Digits (after comma)
            </FormLabel>
            <FormControl>
              <Input
                min={0}
                max={18}
                step={1}
                type="number"
                placeholder="Type a number"
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
