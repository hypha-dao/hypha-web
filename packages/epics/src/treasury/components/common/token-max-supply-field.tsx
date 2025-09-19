'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@hypha-platform/ui';
import { handleNumberChange } from '@hypha-platform/ui-utils';

export function TokenMaxSupplyField() {
  const { setValue, control } = useFormContext();

  const maxSupply = useWatch({
    control,
    name: 'maxSupply',
    defaultValue: 0,
  });

  const handleMaxSupplyChange = handleNumberChange(setValue, 'maxSupply');

  return (
    <FormField
      control={control}
      name="maxSupply"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full">
              Token Max Supply
            </FormLabel>
            {/* @ts-expect-error Server Component */}
            <FormControl>
              <Input
                type="number"
                placeholder="Type an amount or 0 for unlimited supply"
                value={maxSupply}
                onChange={handleMaxSupplyChange}
                name={field.name}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
