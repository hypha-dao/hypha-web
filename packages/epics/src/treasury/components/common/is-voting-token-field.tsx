'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@hypha-platform/ui';
import { Switch } from '@hypha-platform/ui';

export const IsVotingTokenField = () => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="isVotingToken"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full">
              Is Voting Token
            </FormLabel>
            <FormControl>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                className="ml-2"
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
