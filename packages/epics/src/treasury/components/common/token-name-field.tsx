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
import { Asterisk as AsteriskIcon } from 'lucide-react';

export function TokenNameField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full">
              Token Name
              <AsteriskIcon className="text-destructive inline w-4 h-4 align-super" />
            </FormLabel>
            <FormControl>
              <Input placeholder="Type a name" {...field} />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
