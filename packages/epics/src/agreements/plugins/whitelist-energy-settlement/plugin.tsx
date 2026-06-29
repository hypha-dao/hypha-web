'use client';

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  Input,
  Switch,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export const WhitelistEnergySettlementPlugin = () => {
  const { control } = useFormContext();

  return (
    <div className="flex flex-col gap-4">
      <FormField
        control={control}
        name="energySettlementWhitelist.account"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Settlement address</FormLabel>
            <FormDescription>
              Wallet allowed to call consumeEnergy on the community PPA (e.g.
              your backend bot).
            </FormDescription>
            <FormControl>
              <Input
                placeholder="0x..."
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySettlementWhitelist.whitelisted"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border border-neutral-5 p-4">
            <div className="space-y-0.5">
              <FormLabel>Whitelisted</FormLabel>
              <FormDescription>
                Turn off to remove an address from the settlement whitelist.
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value ?? true} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
};
