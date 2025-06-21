'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Textarea,
} from '@hypha-platform/ui';

export function TokenDescriptionField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenDescription"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-start">
            <FormLabel className="text-2 text-neutral-11 w-full">
              Token Short Description
            </FormLabel>
            <FormControl>
              <Textarea
                placeholder="Type a brief description here..."
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
