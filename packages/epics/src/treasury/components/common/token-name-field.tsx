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

export function TokenNameField() {
  const { control } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');

  return (
    <FormField
      control={control}
      name="name"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center">
            <FormLabel className="text-2 text-neutral-11 w-full gap-1">
              {tAgreementFlow('plugins.issueNewToken.general.tokenNameLabel')}{' '}
              <RequirementMark className="text-2" />
            </FormLabel>
            <FormControl>
              <Input
                placeholder={tAgreementFlow(
                  'plugins.issueNewToken.general.tokenNamePlaceholder',
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
