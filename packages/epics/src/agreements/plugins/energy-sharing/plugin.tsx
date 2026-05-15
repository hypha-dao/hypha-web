'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Input,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export const EnergySharingPlugin = () => {
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="energySharing.settlementWindow"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Settlement Window</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Monthly net settlement"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySharing.creditPolicy"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Credit Policy</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Claim any positive balance weekly"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySharing.debtPolicy"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Debt Policy</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. Must settle within 14 days"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySharing.effectiveFrom"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Effective From</FormLabel>
            <FormControl>
              <Input
                type="date"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  );
};
