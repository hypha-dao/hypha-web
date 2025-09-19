'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
} from '@hypha-platform/ui';
import { DecaySettings } from './decay-settings';
import { useFormContext } from 'react-hook-form';

export const DecaySettingsField = ({ name }: { name: string }) => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <FormItem>
          {/* @ts-expect-error Server Component */}
          <FormControl>
            <DecaySettings value={value} onChange={onChange} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
