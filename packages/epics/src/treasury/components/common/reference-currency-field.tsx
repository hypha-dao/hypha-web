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

export const ReferenceCurrencyField = () => {
  const { control, formState } = useFormContext();
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
                Reference Currency
              </span>
              {enableTokenPrice && <RequirementMark className="text-2" />}
            </div>
            <FormControl>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">
                    USD - United States Dollar
                  </SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                  <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  <SelectItem value="HKD">HKD - Hong Kong Dollar</SelectItem>
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
