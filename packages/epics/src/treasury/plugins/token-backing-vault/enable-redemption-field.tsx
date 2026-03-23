'use client';

import { FormField, FormItem, FormControl, Switch } from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';
export function EnableRedemptionField() {
  const { control, setValue } = useFormContext();

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
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setValue('tokenBackingVault.referenceCurrency', undefined);
                    setValue('tokenBackingVault.tokenPrice', undefined);
                    setValue('tokenBackingVault.minimumBackingPercent', 0);
                    setValue(
                      'tokenBackingVault.maxRedemptionPercent',
                      undefined,
                    );
                    setValue(
                      'tokenBackingVault.maxRedemptionPeriodDays',
                      undefined,
                    );
                    setValue('tokenBackingVault.redemptionStartDate', null);
                    setValue(
                      'tokenBackingVault.enableAdvancedRedemptionControls',
                      false,
                    );
                    setValue('tokenBackingVault.redemptionWhitelist', []);
                  }
                  field.onChange(checked);
                }}
                className="ml-2"
              />
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}
