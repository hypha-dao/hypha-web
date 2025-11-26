import { useFormContext } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  Switch,
  FormMessage,
} from '@hypha-platform/ui';

export const EnableAdvancedTransferControlsField = () => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="enableAdvancedTransferControls"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full items-center justify-between text-2 text-neutral-11">
            <span>Optional: Advanced Transfer Controls</span>
            <FormControl>
              <Switch
                checked={field.value ?? false}
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
