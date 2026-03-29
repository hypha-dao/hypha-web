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
import {
  formatCurrencyValue,
  formatLocaleDecimal,
  parseLocaleDecimal,
} from '@hypha-platform/ui-utils';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

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
  const locale = useLocale();
  const { control, setValue, getValues } = useFormContext();
  const tokensAvailableForPurchase = useWatch({
    control,
    name: 'tokensAvailableForPurchase',
  });
  const selectedCurrency = useWatch({
    control,
    name: 'purchaseCurrency',
  });
  const purchasePriceValue = useWatch({
    control,
    name: 'purchasePrice',
  });
  const [purchasePriceText, setPurchasePriceText] = useState('');
  const purchasePriceFocusedRef = useRef(false);

  useEffect(() => {
    if (purchasePriceFocusedRef.current) return;
    if (
      purchasePriceValue === undefined ||
      purchasePriceValue === null ||
      !Number.isFinite(purchasePriceValue)
    ) {
      setPurchasePriceText('');
      return;
    }
    setPurchasePriceText(
      formatLocaleDecimal(purchasePriceValue, locale, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 10,
      }),
    );
  }, [purchasePriceValue, locale]);

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
            {formatCurrencyValue(selectedToken.referencePrice, locale)}{' '}
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
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={formatLocaleDecimal(0, locale, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    value={purchasePriceText}
                    onFocus={() => {
                      purchasePriceFocusedRef.current = true;
                    }}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setPurchasePriceText(raw);
                      const parsed = parseLocaleDecimal(raw, locale);
                      if (parsed !== undefined) {
                        field.onChange(parsed);
                      } else if (raw.trim() === '') {
                        field.onChange(undefined);
                      }
                    }}
                    onBlur={() => {
                      purchasePriceFocusedRef.current = false;
                      field.onBlur();
                      const parsed = parseLocaleDecimal(
                        purchasePriceText,
                        locale,
                      );
                      if (parsed !== undefined) {
                        field.onChange(parsed);
                        setPurchasePriceText(
                          formatLocaleDecimal(parsed, locale, {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 10,
                          }),
                        );
                      } else {
                        field.onChange(undefined);
                        setPurchasePriceText('');
                      }
                    }}
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
              limit: formatCurrencyValue(tokensAvailableLimit, locale),
            })}
          </div>
        )}
      </div>
    </div>
  );
};
