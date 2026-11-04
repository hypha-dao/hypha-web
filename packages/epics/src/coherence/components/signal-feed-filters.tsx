'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import {
  SIGNAL_SORTS,
  SIGNAL_TIME_FRAMES,
  type SignalSort,
  type SignalTimeFrame,
} from '@hypha-platform/core/client';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';

type CoherenceTabKey =
  | 'signalSortNew'
  | 'signalSortTopVoters'
  | 'signalSortTopPower'
  | 'signalTimeFrameNow'
  | 'signalTimeFrameToday'
  | 'signalTimeFrameWeek'
  | 'signalTimeFrameMonth'
  | 'signalTimeFrameYear'
  | 'signalTimeFrameAll';

const TIME_FRAME_LABEL_KEY: Record<SignalTimeFrame, CoherenceTabKey> = {
  now: 'signalTimeFrameNow',
  today: 'signalTimeFrameToday',
  week: 'signalTimeFrameWeek',
  month: 'signalTimeFrameMonth',
  year: 'signalTimeFrameYear',
  all: 'signalTimeFrameAll',
};

const SORT_LABEL_KEY: Record<SignalSort, CoherenceTabKey> = {
  new: 'signalSortNew',
  'top-voters': 'signalSortTopVoters',
  'top-power': 'signalSortTopPower',
};

const MENU_CLASS =
  'min-w-44 rounded-none border border-border bg-background p-1 text-foreground shadow-none';

const ITEM_CLASS =
  'rounded-none text-1 uppercase tracking-[0.12em] data-[state=checked]:bg-foreground/5';

type FilterPillProps<T extends string> = {
  label: string;
  heading: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  testId: string;
};

function FilterPill<T extends string>({
  label,
  heading,
  value,
  options,
  onChange,
  testId,
}: FilterPillProps<T>) {
  const portalStyle = useSpaceAccentPortalStyles();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          data-testid={testId}
          className="data-[state=open]:border-foreground/40 data-[state=open]:bg-foreground/5"
        >
          {label}
          <ChevronDown
            className="size-3.5 shrink-0"
            strokeWidth={1.25}
            aria-hidden
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className={MENU_CLASS}
        style={portalStyle}
        data-space-accent-scope
      >
        <DropdownMenuLabel className="px-3 pb-1.5 pt-2 text-1 font-medium text-muted-foreground">
          {heading}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(next as T)}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className={ITEM_CLASS}
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type SignalFeedFiltersProps = {
  sort: SignalSort;
  timeFrame: SignalTimeFrame;
  onSortChange: (sort: SignalSort) => void;
  onTimeFrameChange: (timeFrame: SignalTimeFrame) => void;
  className?: string;
};

/**
 * Sort control, and a time frame control while a Top sort is selected.
 */
export function SignalFeedFilters({
  sort,
  timeFrame,
  onSortChange,
  onTimeFrameChange,
  className,
}: SignalFeedFiltersProps) {
  const t = useTranslations('CoherenceTab');

  const sortOptions = React.useMemo(
    () =>
      SIGNAL_SORTS.map((value) => ({
        value,
        label: t(SORT_LABEL_KEY[value]),
      })),
    [t],
  );
  const timeFrameOptions = React.useMemo(
    () =>
      SIGNAL_TIME_FRAMES.map((value) => ({
        value,
        label: t(TIME_FRAME_LABEL_KEY[value]),
      })),
    [t],
  );

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <FilterPill
        label={t(SORT_LABEL_KEY[sort])}
        heading={t('signalSortBy')}
        value={sort}
        options={sortOptions}
        onChange={onSortChange}
        testId="signal-sort-pill"
      />
      {sort !== 'new' ? (
        <FilterPill
          label={t(TIME_FRAME_LABEL_KEY[timeFrame])}
          heading={t('signalTimeFrame')}
          value={timeFrame}
          options={timeFrameOptions}
          onChange={onTimeFrameChange}
          testId="signal-time-frame-pill"
        />
      ) : null}
    </div>
  );
}
