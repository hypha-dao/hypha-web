'use client';

import { FormField, FormItem, FormControl, Switch } from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export function EnableAdvancedRedemptionControlsField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.enableAdvancedRedemptionControls"
      render={({ field }) => (
        <FormItem>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <span className="text-2 text-neutral-11">
              Optional: Advanced Redemption Controls
            </span>
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
