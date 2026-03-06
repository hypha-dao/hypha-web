'use client';

import { FormField, FormItem, FormControl, Input } from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export function MaxRedemptionPercentField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.maxRedemptionPercent"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full">
              Maximum Redemption %
            </span>
            <FormControl className="w-full">
              <Input
                type="number"
                min={0}
                max={100}
                placeholder="0 = no limit"
                className="w-full"
                value={field.value ?? ''}
                onChange={(e) =>
                  field.onChange(
                    e.target.value === '' ? undefined : Number(e.target.value),
                  )
                }
              />
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}
