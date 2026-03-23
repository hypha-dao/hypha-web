'use client';

import {
  FormField,
  FormItem,
  FormControl,
  Input,
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

type MaxRedemptionFieldProps = {
  isRequired?: boolean;
};

export function MaxRedemptionField({
  isRequired = false,
}: MaxRedemptionFieldProps) {
  const { control } = useFormContext();

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-center w-full gap-2 flex-wrap">
        <span className="text-2 text-neutral-11 whitespace-nowrap items-center flex gap-1">
          Maximum Redemption %
          {isRequired && <RequirementMark className="text-2" />}
        </span>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
          <FormField
            control={control}
            name="tokenBackingVault.maxRedemptionPercent"
            render={({ field }) => (
              <FormItem className="flex-1 min-w-0 max-w-[120px] mb-0">
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="0 = no limit"
                    className="w-full"
                    value={field.value ?? ''}
                    onChange={(e) => {
                      if (e.target.value === '') {
                        field.onChange(undefined);
                        return;
                      }
                      const parsed = Number(e.target.value);
                      if (!Number.isFinite(parsed)) {
                        field.onChange(undefined);
                        return;
                      }
                      field.onChange(Math.max(0, Math.min(100, parsed)));
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <span className="text-2 text-neutral-11 shrink-0">per</span>
          <FormField
            control={control}
            name="tokenBackingVault.maxRedemptionPeriodDays"
            render={({ field }) => (
              <FormItem className="flex-1 min-w-0 max-w-[140px] mb-0">
                <FormControl>
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
}
