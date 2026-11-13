'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, SearchIcon } from 'lucide-react';
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
  Input,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';

type CoherenceTabKey =
  | 'signalSortNew'
  | 'signalSortTopVoters'
  | 'signalSortTopPower'
  | 'signalTimeFrameToday'
  | 'signalTimeFrameWeek'
  | 'signalTimeFrameMonth'
  | 'signalTimeFrameYear'
  | 'signalTimeFrameAll';

const TIME_FRAME_LABEL_KEY: Record<SignalTimeFrame, CoherenceTabKey> = {
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
  titleQuery: string;
  onTitleQueryChange: (titleQuery: string) => void;
  /** Sits at the end of the search row, the same slot as Agreements. */
  action?: React.ReactNode;
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
  titleQuery,
  onTitleQueryChange,
  action,
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
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex w-full items-center gap-3">
        <Input
          type="search"
          value={titleQuery}
          placeholder={t('searchSignals')}
          aria-label={t('searchSignals')}
          data-testid="signal-title-search"
          onChange={(event) => onTitleQueryChange(event.target.value)}
          leftIcon={<SearchIcon className="text-accent-9" size="16px" />}
          rootClassName="min-w-0 flex-1"
          className="min-w-0"
        />
        {action}
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
    </div>
  );
}
