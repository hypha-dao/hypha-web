'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Input,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export const RegisterEnergySourcePlugin = () => {
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="energySource.sourceId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Source ID</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. SOLAR_ROOF_A"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySource.sourceType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Source Type</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. SOLAR or BATTERY"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySource.basePricePerKwh"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Base Price Per kWh</FormLabel>
            <FormControl>
              <Input
                type="number"
                min="0"
                step="0.0001"
                placeholder="e.g. 0.2500"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energySource.ownershipToken"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ownership Token Address</FormLabel>
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
        name="energySource.deviceIdsCsv"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Device IDs (comma separated)</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. 1001,1002,1003"
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
