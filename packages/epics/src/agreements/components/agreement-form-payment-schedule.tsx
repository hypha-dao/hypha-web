'use client';

import { useState, useEffect } from 'react';
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

const options = ['Immediately', 'Future Payment', 'Milestones'] as const;
type Option = (typeof options)[number];

type DateRange = {
  from: Date | undefined;
  to: Date | undefined;
};

type Milestone = {
  id: string;
  percentage: string;
  dateRange: DateRange | undefined;
};

type AgreementFormPaymentScheduleProps = {
  onChange?: (value: {
    option: Option;
    futureDate?: Date;
    milestones?: Milestone[];
  }) => void;
};

export function AgreementFormPaymentSchedule({
  onChange,
}: AgreementFormPaymentScheduleProps) {
  const [selectedOption, setSelectedOption] = useState<Option>('Immediately');
  const [futureDate, setFutureDate] = useState<Date | undefined>();
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const emitChange = () => {
    onChange?.({
      option: selectedOption,
      futureDate,
      milestones,
    });
  };

  useEffect(() => {
    emitChange();
  }, [selectedOption, futureDate, milestones]);

  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        percentage: '',
        dateRange: { from: undefined, to: undefined },
      },
    ]);
  };

  const removeMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  const updateMilestone = (
    id: string,
    field: 'percentage' | 'dateRange',
    value: any,
  ) => {
    setMilestones((prev) =>
      prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full justify-between items-center gap-2">
        <label className="text-sm text-neutral-11">Payment Schedule</label>

        <div className="flex items-center gap-2">
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
                  onSelect={() => setSelectedOption(option)}
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
      </div>

      {selectedOption === 'Future Payment' && (
        <div className="flex w-full justify-between items-center gap-2">
          <Label className="text-sm text-neutral-11">Date</Label>
          <DatePicker
            mode="single"
            value={futureDate}
            onChange={(date) => setFutureDate(date as Date)}
            placeholder="Select a date"
            className="w-fit"
          />
        </div>
      )}

      {selectedOption === 'Milestones' && (
        <div className="flex flex-col gap-2 items-end">
          {milestones.map((milestone, index) => (
            <div
              key={milestone.id}
              className="flex w-full justify-between items-center gap-2"
            >
              <Label className="text-sm text-neutral-11 min-w-[80px]">
                Milestone {index + 1}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Type a percentage"
                  value={milestone.percentage}
                  onChange={(e) =>
                    updateMilestone(milestone.id, 'percentage', e.target.value)
                  }
                  className="w-[180px]"
                  leftIcon={<PercentIcon color="white" size="16px" />}
                  type="number"
                  min={0}
                  max={100}
                />
                <DatePicker
                  mode="range"
                  value={milestone.dateRange}
                  onChange={(range) =>
                    updateMilestone(
                      milestone.id,
                      'dateRange',
                      range as DateRange,
                    )
                  }
                  className="w-fit"
                />
                <Button
                  variant="ghost"
                  colorVariant="neutral"
                  onClick={() => removeMilestone(milestone.id)}
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
            onClick={addMilestone}
            className="w-fit mt-2"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>
      )}
    </div>
  );
}
