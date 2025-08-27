'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  RequirementMark,
} from '@hypha-platform/ui';
import { TokenIconUpload } from './token-icon';

export function TokenIconField() {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="iconUrl"
      rules={{ required: 'Please upload a token icon' }}
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 gap-1">
              Token Icon <RequirementMark className="text-2" />
            </FormLabel>
            <FormControl>
              <TokenIconUpload
                defaultImage={field.value}
                onChange={field.onChange}
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
