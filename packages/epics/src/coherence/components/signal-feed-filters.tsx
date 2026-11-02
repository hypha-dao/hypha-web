'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import {
  SIGNAL_TIME_FRAMES,
  availableSignalSorts,
  type SignalSort,
  type SignalTimeFrame,
  type SignalVotingMode,
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
  | 'signalSortTop'
  | 'signalSortTopVoters'
  | 'signalSortTopVotersShort'
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

function sortLabelKeys(
  sort: SignalSort,
  votingMode: SignalVotingMode | null,
): { menu: CoherenceTabKey; pill: CoherenceTabKey } {
  if (sort === 'new') return { menu: 'signalSortNew', pill: 'signalSortNew' };
  // With one vote per member, voters is the only Top, so it reads as plain Top.
  if (sort === 'top-voters' && votingMode !== 'token') {
    return { menu: 'signalSortTop', pill: 'signalSortTop' };
  }
  return sort === 'top-voters'
    ? { menu: 'signalSortTopVoters', pill: 'signalSortTopVotersShort' }
    : { menu: 'signalSortTopPower', pill: 'signalSortTop' };
}

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
  votingMode: SignalVotingMode | null;
  onSortChange: (sort: SignalSort) => void;
  onTimeFrameChange: (timeFrame: SignalTimeFrame) => void;
  className?: string;
};

/** Sort pill, plus a time frame pill while a Top sort is selected. */
export function SignalFeedFilters({
  sort,
  timeFrame,
  votingMode,
  onSortChange,
  onTimeFrameChange,
  className,
}: SignalFeedFiltersProps) {
  const t = useTranslations('CoherenceTab');

  const sortOptions = React.useMemo(
    () =>
      availableSignalSorts(votingMode).map((value) => ({
        value,
        label: t(sortLabelKeys(value, votingMode).menu),
      })),
    [t, votingMode],
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
        label={t(sortLabelKeys(sort, votingMode).pill)}
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
