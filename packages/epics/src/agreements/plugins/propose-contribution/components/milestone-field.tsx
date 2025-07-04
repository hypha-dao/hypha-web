'use client';

import { useFormContext } from 'react-hook-form';
import { Label, Input, DatePicker } from '@hypha-platform/ui';
import { PercentIcon } from 'lucide-react';
import { DateRange } from '../validation';

export interface MilestoneFieldProps {
  arrayFieldName: string;
  arrayFieldIndex: number;
}

export const MilestoneField = ({
  arrayFieldName,
  arrayFieldIndex,
}: MilestoneFieldProps) => {
  const { register, setValue, watch } = useFormContext();

  const percentageFieldName = `${arrayFieldName}.${arrayFieldIndex}.percentage`;
  const dateRangeFieldName = `${arrayFieldName}.${arrayFieldIndex}.dateRange`;

  const dateRangeValue = watch(dateRangeFieldName);

  return (
    <div className="flex w-full justify-between items-center gap-2">
      <Label className="text-sm text-neutral-11 min-w-[80px]">
        Milestone {arrayFieldIndex + 1}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          {...register(percentageFieldName, {
            required: 'Percentage is required',
            min: { value: 0, message: 'Percentage must be at least 0' },
            max: { value: 100, message: 'Percentage must be at most 100' },
            valueAsNumber: true,
          })}
          placeholder="Type a percentage"
          className="w-[180px]"
          leftIcon={<PercentIcon color="white" size="16px" />}
          type="number"
        />
        <DatePicker
          mode="range"
          value={dateRangeValue}
          onChange={(val) => setValue(dateRangeFieldName, val as DateRange)}
          className="w-fit"
        />
      </div>
    </div>
  );
};
