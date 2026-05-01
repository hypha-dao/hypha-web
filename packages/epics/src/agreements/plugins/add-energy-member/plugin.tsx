'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  Input,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';

export const AddEnergyMemberPlugin = () => {
  const { control } = useFormContext();

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <FormField
        control={control}
        name="energyMember.memberAddress"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Member Address</FormLabel>
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
        name="energyMember.metadataHash"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Metadata Hash</FormLabel>
            <FormControl>
              <Input
                placeholder="0x... or ipfs hash"
                value={field.value ?? ''}
                onChange={field.onChange}
              />
            </FormControl>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="energyMember.deviceIdsCsv"
        render={({ field }) => (
          <FormItem className="md:col-span-2">
            <FormLabel>Device IDs (comma separated)</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. 201,202,203"
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
