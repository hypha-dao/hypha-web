'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  DatePicker,
  RequirementMark,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { resolveDateFnsLocale } from '../../../coherence/date-fns-locale';

type RedemptionStartDateFieldProps = {
  isRequired?: boolean;
};

export function RedemptionStartDateField({
  isRequired = false,
}: RedemptionStartDateFieldProps) {
  const locale = useLocale();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const dateLocale = resolveDateFnsLocale(locale);
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.redemptionStartDate"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full flex gap-1">
              {tAgreementFlow(
                'plugins.tokenBackingVault.authoriseRedemptionFrom',
              )}
              {isRequired && <RequirementMark className="text-2" />}
            </span>
            <FormControl className="w-full">
              <DatePicker
                mode="single"
                value={field.value ?? undefined}
                locale={dateLocale}
                placeholder={tAgreementFlow(
                  'plugins.tokenBackingVault.selectDate',
                )}
                className="w-fit"
                onChange={(val) =>
                  field.onChange(val instanceof Date ? val : null)
                }
              />
            </FormControl>
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
