import { useFormContext } from 'react-hook-form';
import { Recipient } from './recipient';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';

export function RecipientField({ recipients }: { recipients: any[] }) {
  const { control } = useFormContext();
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
              recipients={recipients}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
