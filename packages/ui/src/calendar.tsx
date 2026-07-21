'use client';

import * as React from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';
import {
  DayPicker,
  DayFlag,
  type DayPickerProps,
  getDefaultClassNames,
  SelectionState,
  UI,
} from 'react-day-picker';

import { cn } from '@hypha-platform/ui-utils';
import { buttonVariants } from './button';

export type CalendarProps = DayPickerProps;

function Calendar({
  className,
  classNames: classNamesProp,
  components: componentsProp,
  showOutsideDays = true,
  disabled: disabledProp,
  ...props
}: CalendarProps) {
  const defaults = React.useMemo(() => getDefaultClassNames(), []);

  const disabled = React.useMemo(() => {
    if (disabledProp !== undefined) {
      return Array.isArray(disabledProp) ? disabledProp : [disabledProp];
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return { before: today };
  }, [disabledProp]);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout="around"
      disabled={disabled}
      className={cn('p-3', className)}
      classNames={{
        ...defaults,
        [UI.Months]: cn(
          defaults[UI.Months],
          'flex flex-col gap-4 sm:flex-row sm:gap-4',
        ),
        [UI.Month]: cn(defaults[UI.Month], 'relative space-y-4'),
        [UI.MonthCaption]: cn(
          defaults[UI.MonthCaption],
          'flex justify-center border-b pb-4 pt-1',
        ),
        [UI.CaptionLabel]: cn(defaults[UI.CaptionLabel], 'text-sm font-medium'),
        [UI.Nav]: cn(defaults[UI.Nav], 'flex items-center gap-1'),
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: 'ghost', colorVariant: 'neutral' }),
          defaults[UI.PreviousMonthButton],
          'absolute left-1 top-1 z-[1] h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: 'ghost', colorVariant: 'neutral' }),
          defaults[UI.NextMonthButton],
          'absolute right-1 top-1 z-[1] h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100',
        ),
        [UI.MonthGrid]: cn(defaults[UI.MonthGrid], 'w-full border-collapse'),
        [UI.Weekdays]: cn(defaults[UI.Weekdays]),
        [UI.Weekday]: cn(
          defaults[UI.Weekday],
          'w-9 min-w-9 px-0 text-center font-normal text-[11px] uppercase text-muted-foreground',
        ),
        [UI.Week]: cn(defaults[UI.Week]),
        [UI.Weeks]: cn(defaults[UI.Weeks]),
        [UI.Day]: cn(
          defaults[UI.Day],
          'relative p-0 text-center text-sm focus-within:relative focus-within:z-20',
        ),
        [UI.DayButton]: cn(
          buttonVariants({ variant: 'ghost' }),
          defaults[UI.DayButton],
          'h-8 w-8 rounded-full p-0 font-normal text-secondary-foreground aria-selected:opacity-100',
        ),
        [DayFlag.today]: cn(
          defaults[DayFlag.today],
          'font-semibold text-accent-9 data-[selected=true]:bg-primary data-[selected=true]:text-primary-foreground',
        ),
        [DayFlag.outside]: cn(
          defaults[DayFlag.outside],
          'text-neutral-11 opacity-50 data-[selected=true]:bg-accent-9 data-[selected=true]:text-secondary-foreground',
        ),
        [DayFlag.disabled]: cn(defaults[DayFlag.disabled], 'opacity-50'),
        [SelectionState.selected]: cn(
          defaults[SelectionState.selected],
          'rounded-full text-secondary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-accent-9 focus:text-secondary-foreground',
        ),
        [SelectionState.range_start]: cn(
          defaults[SelectionState.range_start],
          'rounded-l-full',
        ),
        [SelectionState.range_end]: cn(
          defaults[SelectionState.range_end],
          'rounded-r-full',
        ),
        [SelectionState.range_middle]: cn(
          defaults[SelectionState.range_middle],
          'rounded-none aria-selected:bg-accent aria-selected:text-accent-foreground',
        ),
        ...classNamesProp,
      }}
      components={{
        Chevron: ({
          className: chevronClass,
          orientation,
          ...chevronProps
        }) => {
          const Icon =
            orientation === 'left'
              ? ChevronLeft
              : orientation === 'right'
              ? ChevronRight
              : orientation === 'up'
              ? ChevronUp
              : ChevronDown;
          return (
            <Icon
              className={cn('size-4', chevronClass)}
              aria-hidden
              {...chevronProps}
            />
          );
        },
        ...componentsProp,
      }}
      {...props}
    />
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
