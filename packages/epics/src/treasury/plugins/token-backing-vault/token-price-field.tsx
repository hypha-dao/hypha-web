'use client';

import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Input,
  RequirementMark,
} from '@hypha-platform/ui';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import { useFormContext } from 'react-hook-form';

type TokenPriceFieldProps = {
  /** Token's reference price from contract (shown when redemption inactive) */
  tokenReferencePrice?: number | null;
  /** Token's reference currency (e.g. USD) */
  tokenReferenceCurrency?: string | null;
  /** When true, field is mandatory (redemption active) */
  isRequired?: boolean;
};

export function TokenPriceField({
  tokenReferencePrice,
  tokenReferenceCurrency,
  isRequired = false,
}: TokenPriceFieldProps) {
  const { control } = useFormContext();

  const placeholder = isRequired
    ? 'Enter redemption price'
    : tokenReferencePrice != null
    ? `Leave blank to use token price (${formatCurrencyValue(
        tokenReferencePrice,
      )} ${tokenReferenceCurrency ?? 'USD'})`
    : 'Leave blank for token contract price';

  return (
    <FormField
      control={control}
      name="tokenBackingVault.tokenPrice"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full flex gap-1">
              Token Price
              {isRequired && <RequirementMark className="text-2" />}
            </span>
            <FormControl className="w-full">
              <Input
                type="number"
                step="0.01"
                placeholder={placeholder}
                className="w-full"
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
