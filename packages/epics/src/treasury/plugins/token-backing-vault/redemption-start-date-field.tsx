'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Input,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export function RedemptionStartDateField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.redemptionStartDate"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full">
              Authorise Redemption from
            </span>
            <FormControl className="w-full">
              <Input
                type="datetime-local"
                className="w-full"
                value={
                  field.value
                    ? new Date(field.value).toISOString().slice(0, 16)
                    : ''
                }
                onChange={(e) =>
                  field.onChange(
                    e.target.value ? new Date(e.target.value) : null,
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
