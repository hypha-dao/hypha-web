'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Switch,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export function TransferableField() {
  const { control } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <FormField
      control={control}
      name="transferable"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full items-center justify-between text-2 text-neutral-11">
            <span>
              {tAgreementFlow('plugins.issueNewToken.transfer.transferable')}
            </span>
            <FormControl>
              <Switch
                checked={field.value ?? true}
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
}
