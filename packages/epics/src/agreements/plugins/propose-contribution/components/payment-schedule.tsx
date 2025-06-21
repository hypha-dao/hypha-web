'use client';

import { useFieldArray, useFormContext } from 'react-hook-form';
import { useEffect } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Button,
  Label,
  DatePicker,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/lib/utils';
import { ChevronDownIcon, PlusIcon } from '@radix-ui/react-icons';
import { validateMilestones, validateFutureDate } from '../validation';
import { MilestoneField } from './milestone-field';
import { Cross2Icon } from '@radix-ui/react-icons';

// TODO: will be implemented after MVP
// const options = ['Immediately', 'Future Payment', 'Milestones'] as const;
const options = ['Immediately'] as const;
type Option = (typeof options)[number];

export interface PaymentScheduleProps {
  name?: string;
}

export function PaymentSchedule({
  name = 'paymentSchedule',
}: PaymentScheduleProps) {
  const { watch, setValue, control } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${name}.milestones`,
  });

  const selectedOption = watch(`${name}.option`);
  const milestones = watch(`${name}.milestones`) || [];
  const futureDate = watch(`${name}.futureDate`);
  const milestoneValidationResult = validateMilestones(milestones);
  const futureDateValidationResult = validateFutureDate(futureDate);

  useEffect(() => {
    if (!selectedOption) {
      setValue(`${name}.option`, options[0]);
    }
  }, [selectedOption, setValue, name]);

  const handleOptionChange = (option: Option) => {
    setValue(`${name}.option`, option);
  };

  const handleAddField = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    append({
      percentage: undefined,
      dateRange: { from: undefined, to: undefined },
    });
  };

  return (
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
                onSelect={() => handleOptionChange(option)}
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
            <DatePicker
              mode="single"
              placeholder="Select a date"
              className="w-fit"
              onChange={(val) => setValue(`${name}.futureDate`, val as Date)}
            />
          </div>
          {futureDateValidationResult !== true && (
            <p className="text-error-9 text-sm mt-2 text-end">
              {futureDateValidationResult as string}
            </p>
          )}
        </div>
      )}

      {selectedOption === 'Milestones' && (
        <div className="flex flex-col gap-2 items-end">
          {fields?.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2 w-full">
              <div className="flex-1">
                <MilestoneField
                  key={field.id}
                  arrayFieldName={`${name}.milestones`}
                  arrayFieldIndex={index}
                />
              </div>
              <Button
                variant="ghost"
                colorVariant="neutral"
                onClick={() => {
                  remove(index);
                }}
                size="icon"
                className="ml-1"
              >
                <Cross2Icon className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button
            variant="ghost"
            colorVariant="accent"
            onClick={handleAddField}
            className="w-fit mt-2"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add
          </Button>
          {milestoneValidationResult !== true && (
            <p className="text-error-9 text-sm mt-2">
              {milestoneValidationResult as string}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
