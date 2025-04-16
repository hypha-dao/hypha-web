'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@hypha-platform/lib/utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { DateRange } from 'react-day-picker';

interface DatePickerProps {
  mode?: 'single' | 'range';
  value?: Date | DateRange;
  onChange?: (date: Date | DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  mode = 'single',
  value,
  onChange,
  placeholder = 'Select a date',
  className,
}: DatePickerProps) {
  const [internalValue, setInternalValue] = React.useState<
    Date | DateRange | undefined
  >(value);

  const handleSelect = (date: Date | DateRange | undefined) => {
    setInternalValue(date);
    onChange?.(date);
  };

  const selected = value ?? internalValue;

  const renderLabel = () => {
    if (!selected) return placeholder;

    if (mode === 'single' && selected instanceof Date) {
      return format(selected, 'PPP');
    }

    if (mode === 'range' && typeof selected === 'object') {
      const { from, to } = selected as DateRange;
      if (from && to) return `${format(from, 'PPP')} - ${format(to, 'PPP')}`;
      if (from) return `${format(from, 'PPP')} - ...`;
    }

    return placeholder;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          colorVariant="neutral"
          className={cn(
            'w-fit justify-start text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          {renderLabel()}
          <CalendarIcon className="mr-2 h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode={mode}
          selected={selected as any}
          onSelect={handleSelect as any}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
