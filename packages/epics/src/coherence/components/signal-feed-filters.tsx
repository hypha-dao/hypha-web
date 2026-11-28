'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, SearchIcon } from 'lucide-react';
import {
  COHERENCE_OVERVIEW_TYPES,
  SIGNAL_SORTS,
  type CoherenceOverviewType,
  type SignalSort,
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
  Tabs,
  TabsList,
  TabsTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useSpaceAccentPortalStyles } from '../../spaces/components/space-accent-portal-context';

type CoherenceTabKey =
  | 'signalSortNew'
  | 'signalSortTopVoters'
  | 'signalSortTopPower'
  | `types.${CoherenceOverviewType}`;

const SORT_LABEL_KEY: Record<SignalSort, CoherenceTabKey> = {
  new: 'signalSortNew',
  'top-voters': 'signalSortTopVoters',
  'top-power': 'signalSortTopPower',
};

const MENU_CLASS =
  'min-w-44 rounded-none border border-border bg-background p-1 text-foreground shadow-none';

const ITEM_CLASS =
  'rounded-none text-1 uppercase tracking-[0.12em] data-[state=checked]:bg-foreground/5';

const ALL_PEOPLE = 'all';
const ALL_TYPES = 'all';
const ALL_DOMAINS = 'all';

type FilterPillProps<T extends string> = {
  label: string;
  heading: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
  testId: string;
};

export function FilterPill<T extends string>({
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
        className={cn(MENU_CLASS, 'max-h-72 overflow-y-auto')}
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

export type SignalFeedPerson = {
  id: number;
  label: string;
};

export type SignalFeedFiltersProps = {
  sort: SignalSort;
  onSortChange: (sort: SignalSort) => void;
  personId: number | null;
  people: readonly SignalFeedPerson[];
  onPersonChange: (personId: number | null) => void;
  signalType: CoherenceOverviewType | null;
  onTypeChange: (signalType: CoherenceOverviewType | null) => void;
  domainSlug: string | null;
  domains: readonly { slug: string; name: string }[];
  onDomainChange: (domainSlug: string | null) => void;
  titleQuery: string;
  onTitleQueryChange: (titleQuery: string) => void;
  /** Sits at the end of the search row, the same slot as Agreements. */
  action?: React.ReactNode;
  /** Sits at the start of the sort row, to the left of Sort by. */
  leading?: React.ReactNode;
  className?: string;
};

/**
 * Sort is one control. People, domain, and signal type are filters.
 */
export function SignalFeedFilters({
  sort,
  onSortChange,
  personId,
  people,
  onPersonChange,
  signalType,
  onTypeChange,
  domainSlug,
  domains,
  onDomainChange,
  titleQuery,
  onTitleQueryChange,
  action,
  leading,
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
  const peopleOptions = React.useMemo(
    () => [
      { value: ALL_PEOPLE, label: t('signalFilterAllPeople') },
      ...people.map((person) => ({
        value: String(person.id),
        label: person.label,
      })),
    ],
    [people, t],
  );
  const typeOptions = React.useMemo(
    () => [
      { value: ALL_TYPES, label: t('signalFilterAllTypes') },
      ...COHERENCE_OVERVIEW_TYPES.map((value) => ({
        value,
        label: t(`types.${value}`),
      })),
    ],
    [t],
  );
  const domainOptions = React.useMemo(
    () => [
      { value: ALL_DOMAINS, label: t('signalFilterAllDomains') },
      ...domains.map((domain) => ({
        value: domain.slug,
        label: domain.name,
      })),
    ],
    [domains, t],
  );
  const selectedPerson = people.find((person) => person.id === personId);
  const selectedDomain = domains.find((domain) => domain.slug === domainSlug);

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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {leading}
        <div className="flex items-center gap-2">
          <span className="text-1 font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('signalSortBy')}
          </span>
          <Tabs
            value={sort}
            onValueChange={(value) => onSortChange(value as SignalSort)}
            className="w-auto"
          >
            <TabsList
              className="h-7"
              aria-label={t('signalSortBy')}
              data-testid="signal-sort-tabs"
            >
              {sortOptions.map((option) => (
                <TabsTrigger
                  key={option.value}
                  value={option.value}
                  className="h-7 px-2.5 py-0"
                >
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-1 font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('signalFilters')}
          </span>
          <FilterPill
            label={selectedPerson?.label ?? t('signalFilterPeople')}
            heading={t('signalFilterPeople')}
            value={personId == null ? ALL_PEOPLE : String(personId)}
            options={peopleOptions}
            onChange={(next) =>
              onPersonChange(next === ALL_PEOPLE ? null : Number(next))
            }
            testId="signal-people-pill"
          />
          <FilterPill
            label={selectedDomain?.name ?? t('signalFilterDomain')}
            heading={t('signalFilterDomain')}
            value={domainSlug ?? ALL_DOMAINS}
            options={domainOptions}
            onChange={(next) =>
              onDomainChange(next === ALL_DOMAINS ? null : next)
            }
            testId="signal-domain-pill"
          />
          <FilterPill
            label={
              signalType ? t(`types.${signalType}`) : t('signalFilterType')
            }
            heading={t('signalFilterType')}
            value={signalType ?? ALL_TYPES}
            options={typeOptions}
            onChange={(next) =>
              onTypeChange(
                next === ALL_TYPES ? null : (next as CoherenceOverviewType),
              )
            }
            testId="signal-type-pill"
          />
        </div>
      </div>
    </div>
  );
}
