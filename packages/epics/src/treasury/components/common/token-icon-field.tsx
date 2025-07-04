'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Image,
  // TokenIcon,
} from '@hypha-platform/ui';

export function TokenIconField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="icon"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11">Token Icon</FormLabel>
            <FormControl>
              <Image
                src="/placeholder/space-avatar-image.png"
                alt="Token Icon"
                width={32}
                height={32}
                className="rounded-full object-cover w-8 h-8"
              />
              {/* <TokenIcon value={field.value} onChange={field.onChange} /> */}
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
