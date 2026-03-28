'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  FormLabel,
  Switch,
} from '@hypha-platform/ui';
import { useFormContext, useWatch } from 'react-hook-form';

export const TokenPurchaseToggleSection = () => {
  const { control } = useFormContext();
  const activatePurchase =
    useWatch({ control, name: 'activatePurchase' }) ?? false;

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Token Purchase</FormLabel>
      <span className="text-2 text-neutral-11">
        Activate this option to allow your members to purchase your space&apos;s
        native tokens. Disable at any time.
      </span>
      <FormField
        control={control}
        name="activatePurchase"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between gap-4">
              <label className="text-2 text-neutral-11">
                Activate Token Purchase
              </label>
              <FormControl>
                <Switch
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      {!activatePurchase && (
        <span className="text-2 text-neutral-11 italic">
          When disabled, members can no longer purchase this token.
        </span>
      )}
    </div>
  );
};
