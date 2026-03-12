'use client';

import {
  FormField,
  FormItem,
  FormControl,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  RequirementMark,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';
import { CURRENCY_FEED_OPTIONS } from '@hypha-platform/core/client';

type ReferenceCurrencyFieldProps = {
  isRequired?: boolean;
};

export function ReferenceCurrencyField({ isRequired = false }: ReferenceCurrencyFieldProps) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.referenceCurrency"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full flex gap-1">
              Reference Currency
              {isRequired && <RequirementMark className="text-2" />}
            </span>
            <FormControl className="w-full">
              <Select
                onValueChange={field.onChange}
                value={field.value || CURRENCY_FEED_OPTIONS[0].value}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_FEED_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          </div>
        </FormItem>
      )}
    />
  );
}
