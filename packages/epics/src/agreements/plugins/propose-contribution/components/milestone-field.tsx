'use client';

import { useFormContext } from 'react-hook-form';
import { useMemo } from 'react';
import { addDays, startOfDay } from 'date-fns';
import { Label, Input, DatePicker } from '@hypha-platform/ui';
import { PercentIcon } from 'lucide-react';
import { DateRange } from '../validation';
import { useTranslations } from 'next-intl';

export interface MilestoneFieldProps {
  arrayFieldName: string;
  arrayFieldIndex: number;
}

export const MilestoneField = ({
  arrayFieldName,
  arrayFieldIndex,
}: MilestoneFieldProps) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const { register, setValue, watch } = useFormContext();

  const percentageFieldName = `${arrayFieldName}.${arrayFieldIndex}.percentage`;
  const dateRangeFieldName = `${arrayFieldName}.${arrayFieldIndex}.dateRange`;

  const dateRangeValue = watch(dateRangeFieldName) as DateRange | undefined;
  const milestoneDate = dateRangeValue?.from;
  const minFutureDate = useMemo(() => addDays(startOfDay(new Date()), 1), []);

  return (
    <div className="flex w-full justify-between items-center gap-2">
      <Label className="text-sm text-neutral-11 min-w-[80px]">
        {tAgreementFlow('plugins.milestoneField.milestone', {
          index: arrayFieldIndex + 1,
        })}
      </Label>
      <div className="flex items-center gap-2">
        <Input
          {...register(percentageFieldName, {
            required: tAgreementFlow(
              'plugins.milestoneField.percentageRequired',
            ),
            min: {
              value: 0,
              message: tAgreementFlow('plugins.milestoneField.percentageMin'),
            },
            max: {
              value: 100,
              message: tAgreementFlow('plugins.milestoneField.percentageMax'),
            },
            valueAsNumber: true,
          })}
          placeholder={tAgreementFlow('plugins.milestoneField.typePercentage')}
          className="w-[180px]"
          leftIcon={<PercentIcon color="white" size="16px" />}
          type="number"
        />
        <DatePicker
          mode="single"
          value={milestoneDate}
          minDate={minFutureDate}
          placeholder={tAgreementFlow('plugins.paymentSchedule.selectDate')}
          onChange={(val) =>
            setValue(
              dateRangeFieldName,
              {
                from: val as Date | undefined,
                to: undefined,
              },
              { shouldDirty: true, shouldValidate: true },
            )
          }
          className="w-fit"
        />
      </div>
    </div>
  );
};
