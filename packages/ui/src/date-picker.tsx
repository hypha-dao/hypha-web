'use client';

import * as React from 'react';
import { format, Locale } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';

import { cn } from '@hypha-platform/ui-utils';
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
  locale?: Locale;
}

export function DatePicker({
  mode = 'single',
  value,
  onChange,
  placeholder = 'Select a date',
  className,
  locale,
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
      return format(selected, 'PPP', { locale });
    }

    if (mode === 'range' && typeof selected === 'object') {
      const { from, to } = selected as DateRange;
      if (from && to) {
        return `${format(from, 'PPP', { locale })} - ${format(to, 'PPP', {
          locale,
        })}`;
      }
      if (from) return `${format(from, 'PPP', { locale })} - ...`;
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
        {mode === 'single' ? (
          <Calendar
            mode="single"
            selected={selected instanceof Date ? selected : undefined}
            onSelect={(date) => handleSelect(date)}
            locale={locale}
          />
        ) : (
          <Calendar
            mode="range"
            selected={
              selected &&
              typeof selected === 'object' &&
              !('getTime' in selected)
                ? (selected as DateRange)
                : undefined
            }
            onSelect={(range) => handleSelect(range)}
            locale={locale}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
