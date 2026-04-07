'use client';

import { useFormContext } from 'react-hook-form';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  RequirementMark,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export function TokenSymbolField() {
  const { control } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <FormField
      control={control}
      name="symbol"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full gap-1">
              {tAgreementFlow('plugins.issueNewToken.general.tokenSymbolLabel')}{' '}
              <RequirementMark className="text-2" />
            </FormLabel>
            <FormControl>
              <Input
                placeholder={tAgreementFlow(
                  'plugins.issueNewToken.general.tokenSymbolPlaceholder',
                )}
                {...field}
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
