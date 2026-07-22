'use client';

import * as React from 'react';
import { format, Locale } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
import { DateRange, type Matcher } from 'react-day-picker';

import { cn } from '@hypha-platform/ui-utils';
import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface DatePickerProps {
  mode?: 'single' | 'range';
  value?: Date | DateRange;
  onChange?: (date: Date | DateRange | undefined) => void;
  placeholder?: string;
  className?: string;
  locale?: Locale;
  /** Earliest selectable date (inclusive). Dates before this are disabled. */
  minDate?: Date;
  disabled?: Matcher | Matcher[];
}

export function DatePicker({
  mode = 'single',
  value,
  onChange,
  placeholder = 'Select a date',
  className,
  locale,
  minDate,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState<
    Date | DateRange | undefined
  >(value);

  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  const calendarDisabled = React.useMemo(() => {
    const matchers: Matcher[] = [];
    if (minDate) {
      matchers.push({ before: minDate });
    }
    if (disabled) {
      matchers.push(...(Array.isArray(disabled) ? disabled : [disabled]));
    }
    return matchers.length > 0 ? matchers : undefined;
  }, [minDate, disabled]);

  const handleSelect = (date: Date | DateRange | undefined) => {
    setInternalValue(date);
    onChange?.(date);

    if (mode === 'single' && date instanceof Date) {
      setOpen(false);
      return;
    }

    if (
      mode === 'range' &&
      date &&
      typeof date === 'object' &&
      'from' in date
    ) {
      const range = date as DateRange;
      if (range.from && range.to) {
        setOpen(false);
      }
    }
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
      if (from) return format(from, 'PPP', { locale });
    }

    return placeholder;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          colorVariant="neutral"
          className={cn(
            'w-fit justify-between gap-2 text-left font-normal',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="truncate">{renderLabel()}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        {mode === 'single' ? (
          <Calendar
            mode="single"
            selected={selected instanceof Date ? selected : undefined}
            onSelect={(date) => handleSelect(date)}
            locale={locale}
            disabled={calendarDisabled}
            defaultMonth={
              selected instanceof Date ? selected : minDate ?? new Date()
            }
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
            disabled={calendarDisabled}
            defaultMonth={
              selected &&
              typeof selected === 'object' &&
              !('getTime' in selected) &&
              (selected as DateRange).from
                ? (selected as DateRange).from
                : minDate ?? new Date()
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
