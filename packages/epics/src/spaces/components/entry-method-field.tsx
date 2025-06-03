import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@hypha-platform/ui';
import { EntryMethod } from './entry-method';

export function EntryMethodField({
  entryMethods,
  value,
  onChange,
}: {
  entryMethods: any[];
  value?: any;
  onChange?: (selected: any) => void;
}) {
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
                onChange?.(entryMethod);
              }}
              entryMethods={entryMethods}
              value={value}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
