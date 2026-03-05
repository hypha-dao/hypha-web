'use client';

import { FormField, FormItem, FormControl, Switch } from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export function EnableRedemptionField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.enableRedemption"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full justify-between items-center text-2 text-neutral-11">
            <span>Enable Redemption</span>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                className="ml-2"
              />
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}
