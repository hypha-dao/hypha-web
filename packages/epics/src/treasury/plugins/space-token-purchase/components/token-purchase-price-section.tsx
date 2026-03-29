'use client';

import {
  RequirementMark,
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  FormLabel,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { useFormContext, useWatch } from 'react-hook-form';
import { REFERENCE_CURRENCIES } from '@hypha-platform/core/client';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useEffect } from 'react';
import { useTranslations } from 'next-intl';

type SpaceToken = {
  name: string;
  maxSupply: number;
  referencePrice?: number | null;
  referenceCurrency?: string | null;
};

type TokenPurchasePriceSectionProps = {
  selectedToken: SpaceToken | undefined;
  supply: number | undefined;
};

export const TokenPurchasePriceSection = ({
  selectedToken,
  supply,
}: TokenPurchasePriceSectionProps) => {
  const t = useTranslations('SpaceTokenPurchase');
  const { control, setValue, getValues } = useFormContext();
  const tokensAvailableForPurchase = useWatch({
    control,
    name: 'tokensAvailableForPurchase',
  });
  const selectedCurrency = useWatch({
    control,
    name: 'purchaseCurrency',
  });

  const isLimitedSupply = selectedToken && Number(selectedToken.maxSupply) > 0;

  const tokensAvailableLimit = isLimitedSupply
    ? Math.max(0, Number(selectedToken.maxSupply) - Number(supply ?? 0))
    : undefined;

  const exceedsLimit =
    isLimitedSupply &&
    tokensAvailableLimit !== undefined &&
    Number(tokensAvailableForPurchase) > tokensAvailableLimit;
  const isCurrencyLocked = Boolean(selectedToken?.referenceCurrency);

  useEffect(() => {
    if (!selectedToken?.referenceCurrency) return;
    const current = getValues('purchaseCurrency');
    if (current && current !== selectedToken.referenceCurrency) {
      return;
    }
    setValue('purchaseCurrency', selectedToken.referenceCurrency, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [selectedToken?.referenceCurrency, getValues, setValue]);

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>{t('price.sectionTitle')}</FormLabel>
      <span className="text-2 text-neutral-11">{t('price.description')}</span>

      {selectedToken?.referencePrice && selectedToken?.referenceCurrency && (
        <span className="text-2 text-neutral-11">
          {t('price.currentPriceLabel')}{' '}
          <strong>
            {formatCurrencyValue(selectedToken.referencePrice)}{' '}
            {selectedToken.referenceCurrency}
          </strong>{' '}
          {t('price.currentPriceSuffix')}
        </span>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
        <div className="flex gap-1">
          <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
            {t('price.fieldLabel')}
          </label>
          <RequirementMark className="text-2" />
        </div>
        <div className="flex gap-2 grow min-w-0">
          <FormField
            control={control}
            name="purchasePrice"
            render={({ field }) => (
              <FormItem className="grow">
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    min="0"
                    step="0.0001"
                    placeholder="0.00"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="purchaseCurrency"
            render={({ field }) => (
              <FormItem className="min-w-[100px]">
                <FormControl>
                  <Select
                    value={field.value ?? ''}
                    onValueChange={field.onChange}
                    disabled={isCurrencyLocked}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('price.currencyPlaceholder')}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(isCurrencyLocked && selectedCurrency
                        ? [selectedCurrency]
                        : REFERENCE_CURRENCIES
                      ).map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-1">
          <label className="text-2 text-neutral-11 whitespace-nowrap">
            {t('price.availableAtThisPriceLabel')}
          </label>
        </div>
        <FormField
          control={control}
          name="tokensAvailableForPurchase"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Input
                  {...field}
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {exceedsLimit && tokensAvailableLimit !== undefined && (
          <div className="text-2 text-foreground">
            {t('price.exceedsLimit', {
              limit: formatCurrencyValue(tokensAvailableLimit),
            })}
          </div>
        )}
      </div>
    </div>
  );
};
