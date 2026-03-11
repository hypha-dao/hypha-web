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
  const { control } = useFormContext();
  const tokensAvailableForPurchase = useWatch({
    control,
    name: 'tokensAvailableForPurchase',
  });

  const isLimitedSupply = selectedToken && Number(selectedToken.maxSupply) > 0;

  const tokensAvailableLimit = isLimitedSupply
    ? Math.max(0, Number(selectedToken.maxSupply) - Number(supply ?? 0))
    : undefined;

  const exceedsLimit =
    isLimitedSupply &&
    tokensAvailableLimit !== undefined &&
    Number(tokensAvailableForPurchase) > tokensAvailableLimit;

  return (
    <div className="flex flex-col gap-4">
      <FormLabel>Token Purchase Price</FormLabel>
      <span className="text-2 text-neutral-11">
        Set a custom purchase price, or use the default treasury price.
      </span>

      {selectedToken?.referencePrice && selectedToken?.referenceCurrency && (
        <span className="text-2 text-neutral-11">
          Current price in treasury:{' '}
          <strong>
            {selectedToken.referencePrice} {selectedToken.referenceCurrency}
          </strong>{' '}
          — set in your space&apos;s token configuration.
        </span>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start w-full">
        <div className="flex gap-1">
          <label className="text-2 text-neutral-11 whitespace-nowrap md:min-w-max items-center md:pt-1">
            Token Purchase Price
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
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {REFERENCE_CURRENCIES.map((currency) => (
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
            Tokens Available for Purchase at this Price
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
            The number of tokens requested exceeds the Tokens Available for
            Purchase Limit. Please enter a value up to{' '}
            {formatCurrencyValue(tokensAvailableLimit)}.
          </div>
        )}
      </div>
    </div>
  );
};
