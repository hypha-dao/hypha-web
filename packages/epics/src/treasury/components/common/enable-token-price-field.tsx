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

export const EnableTokenPriceField = () => {
  const { control } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <FormField
      control={control}
      name="enableTokenPrice"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full justify-between items-center text-2 text-neutral-11">
            <span>{tAgreementFlow('plugins.issueNewToken.value.enable')}</span>
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
