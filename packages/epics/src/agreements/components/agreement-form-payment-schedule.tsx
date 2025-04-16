'use client';

import { useEffect } from 'react';
import {
  useForm,
  Controller,
  useFieldArray,
  FormProvider,
} from 'react-hook-form';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  Label,
  Input,
  DatePicker,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/lib/utils';
import { ChevronDownIcon, PlusIcon, Cross2Icon } from '@radix-ui/react-icons';
import { PercentIcon } from 'lucide-react';
import { isBefore } from 'date-fns';

const options = ['Immediately', 'Future Payment', 'Milestones'] as const;
type Option = (typeof options)[number];

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

type Milestone = {
  percentage: string;
  dateRange: DateRange;
};

type FormValues = {
  option: Option;
  futureDate?: Date;
  milestones: Milestone[];
};

type AgreementFormPaymentScheduleProps = {
  onChange?: (value: FormValues) => void;
};

export function AgreementFormPaymentSchedule({
  onChange,
}: AgreementFormPaymentScheduleProps) {
  const methods = useForm<FormValues>({
    defaultValues: {
      option: 'Immediately',
      futureDate: undefined,
      milestones: [],
    },
    mode: 'onChange',
  });

  const {
    control,
    watch,
    setValue,
    formState: { errors },
  } = methods;

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'milestones',
  });

  const selectedOption = watch('option');
  const milestones = watch('milestones');
  const futureDate = watch('futureDate');

  useEffect(() => {
    onChange?.({
      option: selectedOption,
      futureDate,
      milestones,
    });
  }, [selectedOption, futureDate, milestones]);

  const validateMilestones = () => {
    const total = milestones.reduce(
      (sum, m) => sum + Number(m.percentage || 0),
      0,
    );

    const now = new Date();

    for (let i = 0; i < milestones.length; i++) {
      const { dateRange } = milestones[i];

      if (!dateRange?.from) return 'Each milestone must have a start date';
      if (i === 0 && isBefore(dateRange.from, now)) {
        return 'First milestone must be in the future';
      }
      if (
        i > 0 &&
        isBefore(dateRange.from!, milestones[i - 1].dateRange.from!)
      ) {
        return `Milestone ${i + 1} must be after milestone ${i}`;
      }
    }

    if (total > 100) return 'Total percentage cannot exceed 100%';
    return true;
  };

  const validateFutureDate = (date: Date | undefined) => {
    const now = new Date();
    if (date && isBefore(date, now)) {
      return 'The future payment date must be later than the current date';
    }
    return true;
  };

  return (
    <FormProvider {...methods}>
      <div className="flex flex-col gap-4">
        <div className="flex w-full justify-between items-center gap-2">
          <label className="text-sm text-neutral-11">Payment Schedule</label>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                colorVariant="neutral"
                className="justify-between w-fit"
              >
                {selectedOption}
                <ChevronDownIcon className="w-2 h-2 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {options.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onSelect={() => setValue('option', option)}
                  className={cn(
                    selectedOption === option &&
                      'bg-accent text-accent-foreground',
                  )}
                >
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {selectedOption === 'Future Payment' && (
          <div className="flex flex-col w-full gap-2">
            <div className="flex w-full justify-between items-center gap-2">
              <Label className="text-sm text-neutral-11">Date</Label>
              <Controller
                control={control}
                name="futureDate"
                rules={{
                  validate: validateFutureDate,
                }}
                render={({ field }) => (
                  <DatePicker
                    mode="single"
                    value={field.value}
                    onChange={(val) => field.onChange(val as Date)}
                    placeholder="Select a date"
                    className="w-fit"
                  />
                )}
              />
            </div>
            {errors.futureDate && (
              <p className="text-error-9 text-sm ml-auto">
                {errors.futureDate.message}
              </p>
            )}
          </div>
        )}

        {selectedOption === 'Milestones' && (
          <div className="flex flex-col gap-2 items-end">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex w-full justify-between items-center gap-2"
              >
                <Label className="text-sm text-neutral-11 min-w-[80px]">
                  Milestone {index + 1}
                </Label>
                <div className="flex items-center gap-2">
                  <Controller
                    control={control}
                    name={`milestones.${index}.percentage`}
                    rules={{ required: true, min: 0, max: 100 }}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="Type a percentage"
                        className="w-[180px]"
                        leftIcon={<PercentIcon color="white" size="16px" />}
                        type="number"
                      />
                    )}
                  />
                  <Controller
                    control={control}
                    name={`milestones.${index}.dateRange`}
                    render={({ field }) => (
                      <DatePicker
                        mode="range"
                        value={field.value}
                        onChange={(val) => field.onChange(val as DateRange)}
                        className="w-fit"
                      />
                    )}
                  />
                  <Button
                    variant="ghost"
                    colorVariant="neutral"
                    onClick={() => remove(index)}
                    size="icon"
                    className="ml-1"
                  >
                    <Cross2Icon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            <Button
              variant="ghost"
              colorVariant="accent"
              onClick={() =>
                append({
                  percentage: '',
                  dateRange: { from: undefined, to: undefined },
                })
              }
              className="w-fit mt-2"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add
            </Button>

            {selectedOption === 'Milestones' &&
              validateMilestones() !== true && (
                <p className="text-error-9 text-sm mt-2">
                  {validateMilestones() as string}
                </p>
              )}
          </div>
        )}
      </div>
    </FormProvider>
  );
}
