'use client';

import React from 'react';
import {
  DEAL_PRIORITIES,
  DEAL_STATUSES,
  usePipelineConfig,
  type DealFilters,
  type DealPriority,
  type DealStatus,
  type PipelineSwimlane,
  type Region,
} from '@hypha-platform/core/client';
import {
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { useLocale, useTranslations } from 'next-intl';
import { ListFilter, X } from 'lucide-react';
import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import type { UseMembers } from '../../spaces';
import { CountrySelect } from './country-select';
import { SpaceMemberSelect } from './space-member-select';

type FilterBarProps = {
  spaceSlug: string;
  filters: DealFilters;
  onChange: (filters: DealFilters) => void;
  useMembers: UseMembers;
  /** Optional country allow-list from user settings. */
  countryFocus?: string[];
  /**
   * Swimlane already implied by the page (a single track). It stays applied,
   * but does not count as a selected filter on its own.
   */
  lockedSwimlane?: PipelineSwimlane;
};

function asList<T>(value: T | T[] | undefined): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function withoutValue<T>(
  current: T | T[] | undefined,
  value: T,
): T | T[] | undefined {
  const list = asList(current).filter((item) => item !== value);
  if (list.length === 0) return undefined;
  if (list.length === 1) return list[0];
  return list;
}

function formatStatusLabel(status: DealStatus): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatPriorityLabel(priority: DealPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function MenuField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const t = useTranslations('Pipeline');
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t('removeFilter', { label })}
      className="inline-flex h-6 items-center gap-1.5 border border-border bg-background px-2 text-1 text-foreground hover:border-foreground"
    >
      <span>{label}</span>
      <X className="size-3 shrink-0" strokeWidth={1.25} aria-hidden />
    </button>
  );
}

export function FilterBar({
  spaceSlug,
  filters,
  onChange,
  useMembers,
  countryFocus,
  lockedSwimlane,
}: FilterBarProps) {
  const t = useTranslations('Pipeline');
  const locale = useLocale();
  const { regions, tracks, itemSingular } = usePipelineConfig(spaceSlug);
  const { persons } = useMembers({ spaceSlug, paginationDisabled: true });
  const members = persons?.data ?? [];
  const regionNames = React.useMemo(() => {
    try {
      return new Intl.DisplayNames([locale], { type: 'region' });
    } catch {
      return null;
    }
  }, [locale]);

  const swimlaneValues = asList(filters.swimlane);
  const countryValues = asList(filters.country);
  const regionValues = asList(filters.region);
  const priorityValues = asList(filters.priority);
  const statusValues = asList(filters.status);
  const swimlaneActive =
    lockedSwimlane == null
      ? swimlaneValues.length > 0
      : swimlaneValues.some((value) => value !== lockedSwimlane);
  const active =
    swimlaneActive ||
    countryValues.length > 0 ||
    regionValues.length > 0 ||
    filters.accountManagerId != null ||
    priorityValues.length > 0 ||
    statusValues.length > 0 ||
    filters.hasDeadline != null ||
    Boolean(filters.tag?.trim());

  const visibleSwimlanes = swimlaneActive
    ? swimlaneValues.filter(
        (value) => lockedSwimlane == null || value !== lockedSwimlane,
      )
    : [];

  const accountManager = members.find(
    (person) => person.id === filters.accountManagerId,
  );

  const reset = () => {
    onChange({
      ...(filters.q ? { q: filters.q } : {}),
      ...(lockedSwimlane ? { swimlane: lockedSwimlane } : {}),
    });
  };

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Input
          type="search"
          rootClassName="min-h-6"
          className="h-6 min-h-6 min-w-0 flex-1 py-1"
          placeholder={t('filters.search')}
          aria-label={t('filters.searchLabel')}
          value={filters.q ?? ''}
          onChange={(event) =>
            onChange({ ...filters, q: event.target.value || undefined })
          }
        />
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('filter')}
              title={t('filter')}
              className={cn(
                'inline-flex h-6 w-6 shrink-0 items-center justify-center border bg-background text-muted-foreground hover:text-foreground',
                active
                  ? 'border-foreground text-foreground'
                  : 'border-border/70',
              )}
            >
              <ListFilter
                className="craft-icon"
                strokeWidth={1.25}
                aria-hidden
              />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            collisionPadding={16}
            onPointerDownOutside={(event) => {
              const target = event.target;
              if (
                target instanceof Element &&
                target.closest(
                  '[data-radix-popper-content-wrapper], [role="listbox"]',
                )
              ) {
                event.preventDefault();
              }
            }}
            className="narrow-scrollbar max-h-[var(--radix-popover-content-available-height,70dvh)] w-80 overflow-y-auto overscroll-contain rounded-none border-border bg-background p-0 text-foreground shadow-none"
          >
            <div className="grid gap-3 px-3 py-3">
              <MenuField label={t('filters.swimlane')}>
                <Select
                  value={asList(filters.swimlane)[0] ?? 'all'}
                  onValueChange={(value) =>
                    onChange({
                      ...filters,
                      swimlane:
                        value === 'all'
                          ? lockedSwimlane
                          : (value as PipelineSwimlane),
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-full py-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('filters.allSwimlanes')}
                    </SelectItem>
                    {tracks.map((track) => (
                      <SelectItem key={track.slug} value={track.slug}>
                        {track.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </MenuField>
              <MenuField label={t('filters.country')}>
                <CountrySelect
                  className="h-6 w-full py-1"
                  value={asList(filters.country)[0] ?? null}
                  countryFocus={countryFocus}
                  popoverModal
                  placeholder={t('filters.allCountries')}
                  searchPlaceholder={t('filters.countrySearch')}
                  noneLabel={t('filters.allCountries')}
                  emptyListMessage={t('newDeal.noCountries')}
                  onChange={(code) =>
                    onChange({
                      ...filters,
                      country: code ?? undefined,
                    })
                  }
                />
              </MenuField>
              <MenuField label={t('filters.region')}>
                <Select
                  value={asList(filters.region)[0] ?? 'all'}
                  onValueChange={(value) =>
                    onChange({
                      ...filters,
                      region: value === 'all' ? undefined : (value as Region),
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-full py-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('filters.allRegions')}
                    </SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region} value={region}>
                        {region}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </MenuField>
              <MenuField label={t('filters.accountManager')}>
                <SpaceMemberSelect
                  className="h-6 w-full py-1"
                  members={members}
                  value={
                    filters.accountManagerId != null
                      ? String(filters.accountManagerId)
                      : null
                  }
                  onChange={(id) =>
                    onChange({
                      ...filters,
                      accountManagerId: id ? Number(id) : undefined,
                    })
                  }
                  unassignedLabel={t('filters.allAccountManagers')}
                  searchPlaceholder={t('newDeal.memberSearch')}
                  emptyListMessage={t('newDeal.noMembers')}
                  unknownLabel={t('newDeal.unknownMember')}
                />
              </MenuField>
              <MenuField label={t('filters.priority')}>
                <Select
                  value={asList(filters.priority)[0] ?? 'all'}
                  onValueChange={(value) =>
                    onChange({
                      ...filters,
                      priority:
                        value === 'all' ? undefined : (value as DealPriority),
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-full py-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('filters.allPriorities')}
                    </SelectItem>
                    {DEAL_PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {formatPriorityLabel(priority)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </MenuField>
              <MenuField label={t('filters.status', { item: itemSingular })}>
                <Select
                  value={asList(filters.status)[0] ?? 'all'}
                  onValueChange={(value) =>
                    onChange({
                      ...filters,
                      status:
                        value === 'all' ? undefined : (value as DealStatus),
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-full py-1">
                    <SelectValue>
                      {(() => {
                        const status = asList(filters.status)[0];
                        return status
                          ? formatStatusLabel(status)
                          : t('filters.allStatuses');
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('filters.allStatuses')}
                    </SelectItem>
                    {DEAL_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatStatusLabel(status)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </MenuField>
              <MenuField label={t('filters.deadline')}>
                <Select
                  value={
                    filters.hasDeadline === true
                      ? 'yes'
                      : filters.hasDeadline === false
                      ? 'no'
                      : 'all'
                  }
                  onValueChange={(value) =>
                    onChange({
                      ...filters,
                      hasDeadline:
                        value === 'all'
                          ? undefined
                          : value === 'yes'
                          ? true
                          : false,
                    })
                  }
                >
                  <SelectTrigger className="h-6 w-full py-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t('filters.anyDeadline')}
                    </SelectItem>
                    <SelectItem value="yes">
                      {t('filters.hasDeadline')}
                    </SelectItem>
                    <SelectItem value="no">
                      {t('filters.noDeadline')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </MenuField>
              <MenuField label={t('filters.tagLabel', { item: itemSingular })}>
                <Input
                  rootClassName="min-h-6"
                  className="h-6 min-h-6 w-full py-1"
                  placeholder={t('filters.tagPlaceholder', {
                    item: itemSingular,
                  })}
                  value={filters.tag ?? ''}
                  onChange={(event) =>
                    onChange({
                      ...filters,
                      tag: event.target.value || undefined,
                    })
                  }
                />
              </MenuField>
            </div>
            {active ? (
              <div className="flex justify-end border-t border-border px-3 py-2">
                <button
                  type="button"
                  onClick={reset}
                  className="text-1 text-neutral-11 hover:text-foreground"
                >
                  {t('reset')}
                </button>
              </div>
            ) : null}
          </PopoverContent>
        </Popover>
      </div>
      {active ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {visibleSwimlanes.map((swimlane) => (
            <FilterTag
              key={swimlane}
              label={
                tracks.find((track) => track.slug === swimlane)?.name ??
                swimlane
              }
              onRemove={() =>
                onChange({
                  ...filters,
                  swimlane: withoutValue(filters.swimlane, swimlane),
                })
              }
            />
          ))}
          {countryValues.map((country) => (
            <FilterTag
              key={country}
              label={regionNames?.of(country) ?? country}
              onRemove={() =>
                onChange({
                  ...filters,
                  country: withoutValue(filters.country, country),
                })
              }
            />
          ))}
          {regionValues.map((region) => (
            <FilterTag
              key={region}
              label={region}
              onRemove={() =>
                onChange({
                  ...filters,
                  region: withoutValue(filters.region, region),
                })
              }
            />
          ))}
          {filters.accountManagerId != null ? (
            <FilterTag
              label={
                accountManager
                  ? personRosterDisplayLabel(
                      accountManager,
                      t('newDeal.unknownMember'),
                    )
                  : t('newDeal.unknownMember')
              }
              onRemove={() =>
                onChange({ ...filters, accountManagerId: undefined })
              }
            />
          ) : null}
          {priorityValues.map((priority) => (
            <FilterTag
              key={priority}
              label={formatPriorityLabel(priority)}
              onRemove={() =>
                onChange({
                  ...filters,
                  priority: withoutValue(filters.priority, priority),
                })
              }
            />
          ))}
          {statusValues.map((status) => (
            <FilterTag
              key={status}
              label={formatStatusLabel(status)}
              onRemove={() =>
                onChange({
                  ...filters,
                  status: withoutValue(filters.status, status),
                })
              }
            />
          ))}
          {filters.hasDeadline != null ? (
            <FilterTag
              label={
                filters.hasDeadline
                  ? t('filters.hasDeadline')
                  : t('filters.noDeadline')
              }
              onRemove={() => onChange({ ...filters, hasDeadline: undefined })}
            />
          ) : null}
          {filters.tag?.trim() ? (
            <FilterTag
              label={filters.tag}
              onRemove={() => onChange({ ...filters, tag: undefined })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
