'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  RequirementMark,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

/** Match TOKEN_PRICE_REFERENCE_CURRENCIES — no Chainlink X/USD feed for CNY, JPY, HKD on Base */
const CURRENCY_OPTIONS = [
  { value: 'USD', key: 'usd' },
  { value: 'GBP', key: 'gbp' },
  { value: 'CAD', key: 'cad' },
  { value: 'EUR', key: 'eur' },
  { value: 'CHF', key: 'chf' },
  { value: 'AUD', key: 'aud' },
  { value: 'NZD', key: 'nzd' },
] as const;

export const ReferenceCurrencyField = () => {
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
      name="referenceCurrency"
      render={({ field }) => (
        <FormItem>
          <div className="flex w-full justify-between">
            <div className="flex gap-1 w-full">
              <span className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
                {tAgreementFlow(
                  'plugins.issueNewToken.value.referenceCurrencyLabel',
                )}
              </span>
              {enableTokenPrice && <RequirementMark className="text-2" />}
            </div>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={tAgreementFlow(
                      'plugins.issueNewToken.value.referenceCurrencyPlaceholder',
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.value} -{' '}
                      {tAgreementFlow(
                        `plugins.issueNewToken.value.currencies.${currency.key}` as Parameters<
                          typeof tAgreementFlow
                        >[0],
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          </div>
          {formState.isSubmitted && <FormMessage />}
        </FormItem>
      )}
    />
  );
};
