import { useFormContext } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  Switch,
  FormMessage,
} from '@hypha-platform/ui';

export const EnableProposalAutoMintingField = () => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="enableProposalAutoMinting"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full justify-between items-center text-2 text-neutral-11">
            <span>Enable Proposal Auto-Minting</span>
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
