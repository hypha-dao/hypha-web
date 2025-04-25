import { z } from 'zod';
import { useFormContext } from 'react-hook-form';
import { Recipient } from './recipient';
import { schemaProposeContribution } from '../../propose-contribution/validation';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';

export const RecipientField = () => {
  const { control } =
    useFormContext<z.infer<typeof schemaProposeContribution>>();
  return (
    <FormField
      control={control}
      name="recipient"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Recipient
              onChange={(recipient) => {
                field.onChange(recipient.address);
              }}
              recipients={[]}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
