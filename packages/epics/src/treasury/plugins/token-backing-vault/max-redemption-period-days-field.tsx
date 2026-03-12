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
  FormMessage,
} from '@hypha-platform/ui';
import { useFormContext } from 'react-hook-form';
import { MAX_REDEMPTION_PERIOD_OPTIONS } from '@hypha-platform/core/client';

type MaxRedemptionPeriodDaysFieldProps = {
  isRequired?: boolean;
};

export function MaxRedemptionPeriodDaysField({ isRequired = false }: MaxRedemptionPeriodDaysFieldProps) {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name="tokenBackingVault.maxRedemptionPeriodDays"
      render={({ field }) => (
        <FormItem>
          <div className="flex justify-between items-center w-full">
            <span className="text-2 text-neutral-11 whitespace-nowrap items-center w-full flex gap-1">
              Period (days)
              {isRequired && <RequirementMark className="text-2" />}
            </span>
            <FormControl className="w-full">
              <Select
                onValueChange={(v) => field.onChange(Number(v))}
                value={String(field.value ?? '')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {MAX_REDEMPTION_PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={String(opt.value)}>
                      {opt.label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormControl>
        </div>
        <FormMessage />
      </FormItem>
    )}
  />
);
}
