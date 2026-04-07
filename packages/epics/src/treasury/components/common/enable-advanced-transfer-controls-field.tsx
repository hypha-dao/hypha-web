'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  Switch,
  FormMessage,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export const EnableAdvancedTransferControlsField = () => {
  const { control } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <FormField
      control={control}
      name="enableAdvancedTransferControls"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full items-center justify-between text-2 text-neutral-11">
            <span>
              {tAgreementFlow(
                'plugins.issueNewToken.transfer.advancedControls',
              )}
            </span>
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
