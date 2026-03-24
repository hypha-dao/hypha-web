'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  Input,
  FormMessage,
  RequirementMark,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

export const TokenPriceField = () => {
  const { control, formState } = useFormContext();
  const tAgreementFlow = useTranslations('AgreementFlow');
  const enableTokenPrice = useWatch({
    control,
    name: 'enableTokenPrice',
    defaultValue: false,
  });

  return (
    <FormField
      control={control}
      name="tokenPrice"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full justify-between">
            <div className="flex gap-1 w-full">
              <span className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                {tAgreementFlow('plugins.issueNewToken.value.tokenPriceLabel')}
              </span>
              {enableTokenPrice && <RequirementMark className="text-2" />}
            </div>
            <FormControl>
              <Input
                type="number"
                placeholder={tAgreementFlow(
                  'plugins.issueNewToken.value.tokenPricePlaceholder',
                )}
                {...field}
                value={field.value ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  field.onChange(value === '' ? undefined : value);
                }}
              />
            </FormControl>
          </div>
          {formState.isSubmitted && <FormMessage />}
        </FormItem>
      )}
    />
  );
};
