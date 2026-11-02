'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Archive, ChevronDown } from 'lucide-react';
import {
  SIGNAL_SORTS,
  SIGNAL_TIME_FRAMES,
  type SignalSort,
  type SignalTimeFrame,
} from '@hypha-platform/core/client';
import {
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

const PILL_CLASS =
  'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-1 font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground';

const MENU_CLASS =
  'min-w-44 rounded-xl border border-border/80 bg-background-2 p-1.5 text-foreground shadow-md';

const ITEM_CLASS =
  'rounded-lg py-2.5 pl-8 pr-3 text-2 data-[state=checked]:bg-foreground/5';

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
        <button type="button" className={PILL_CLASS} data-testid={testId}>
          {label}
          <ChevronDown className="size-4 shrink-0" aria-hidden />
        </button>
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
  showArchived?: boolean;
  onShowArchivedChange?: (showArchived: boolean) => void;
  className?: string;
};

/**
 * Sort pill, a time frame pill while a Top sort is selected, and a toggle
 * that brings archived signals back into the feed.
 */
export function SignalFeedFilters({
  sort,
  timeFrame,
  onSortChange,
  onTimeFrameChange,
  showArchived = false,
  onShowArchivedChange,
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
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
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
      {onShowArchivedChange ? (
        <button
          type="button"
          aria-pressed={showArchived}
          onClick={() => onShowArchivedChange(!showArchived)}
          className={cn(
            PILL_CLASS,
            showArchived && 'bg-foreground/10 text-foreground',
          )}
          data-testid="signal-show-archived-toggle"
        >
          <Archive className="size-4 shrink-0" aria-hidden />
          {t('signalShowArchived')}
        </button>
      ) : null}
    </div>
  );
}
