import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import { EntryMethod } from './entry-method';

export function EntryMethodField({ entryMethods }: { entryMethods: any[] }) {
  const { control } = useFormContext();
  return (
    <FormField
      control={control}
      name="entryMethod"
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <EntryMethod
              onChange={(entryMethod) => {
                field.onChange(entryMethod.value);
              }}
              entryMethods={entryMethods}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
