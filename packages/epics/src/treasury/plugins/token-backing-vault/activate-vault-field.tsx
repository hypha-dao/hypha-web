'use client';

import { FormField, FormItem, FormControl, Switch } from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export function ActivateVaultField() {
  const { control, setValue } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.activateVault"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full justify-between items-center text-2 text-neutral-11">
            <span>Activate Vault</span>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setValue('tokenBackingVault.addCollaterals', []);
                    setValue('tokenBackingVault.removeCollaterals', []);
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
