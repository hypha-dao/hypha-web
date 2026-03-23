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
import { useTranslations } from 'next-intl';

type RedemptionStartDateFieldProps = {
  isRequired?: boolean;
};

export function RedemptionStartDateField({
  isRequired = false,
}: RedemptionStartDateFieldProps) {
  const tAgreementFlow = useTranslations('AgreementFlow');
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
