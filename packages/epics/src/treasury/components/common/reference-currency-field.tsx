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
import { TOKEN_PRICE_REFERENCE_CURRENCIES } from '@hypha-platform/core/client';

/**
 * Match TOKEN_PRICE_REFERENCE_CURRENCIES.
 * Most entries have an X/USD AggregatorV3 feed. TZS is display/portfolio
 * only (no Base feed). CNY, JPY and HKD stay absent (no feed and no
 * off-chain rate). XPF is served by the XpfUsdOracle adapter.
 */
const CURRENCY_OPTIONS = TOKEN_PRICE_REFERENCE_CURRENCIES.map((value) => ({
  value,
  key: value.toLowerCase(),
}));

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
