'use client';

import React from 'react';
import {
  DEAL_PRIORITIES,
  DEAL_STATUSES,
  PIPELINE_SWIMLANES,
  usePipelineConfig,
  type DealFilters,
  type DealPriority,
  type DealStatus,
  type PipelineSwimlane,
  type Region,
} from '@hypha-platform/core/client';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';
import { Download } from 'lucide-react';
import type { UseMembers } from '../../spaces';
import { CountrySelect } from './country-select';
import { SpaceMemberSelect } from './space-member-select';

type FilterBarProps = {
  spaceSlug: string;
  filters: DealFilters;
  onChange: (filters: DealFilters) => void;
  onExport: () => void;
  useMembers: UseMembers;
  savedViewsSlot?: React.ReactNode;
  /** Optional country allow-list from user settings. */
  countryFocus?: string[];
};

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-[140px] flex-col gap-1">
      <span className="text-1 text-neutral-11">{label}</span>
      {children}
    </div>
  );
}

/**
 * Saved views can restore array-valued filters; single-select controls need a
 * scalar, so bind the first value (or none) in that case.
 */
function firstValue<T>(value: T | T[] | undefined): T | undefined {
  if (value == null) return undefined;
  return Array.isArray(value) ? value[0] : value;
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

export function FilterBar({
  spaceSlug,
  filters,
  onChange,
  onExport,
  useMembers,
  savedViewsSlot,
  countryFocus,
}: FilterBarProps) {
  const t = useTranslations('Pipeline');
  const { regions } = usePipelineConfig(spaceSlug);
  const { persons } = useMembers({ spaceSlug, paginationDisabled: true });
  const members = persons?.data ?? [];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-1 size-3.5" />
          {t('exportXlsx')}
        </Button>
        {savedViewsSlot}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <FilterField label={t('filters.searchLabel')}>
          <Input
            className="min-w-[180px] max-w-xs"
            placeholder={t('filters.search')}
            value={filters.q ?? ''}
            onChange={(e) =>
              onChange({ ...filters, q: e.target.value || undefined })
            }
          />
        </FilterField>
        <FilterField label={t('filters.swimlane')}>
          <Select
            value={firstValue(filters.swimlane) ?? 'all'}
            onValueChange={(value) =>
              onChange({
                ...filters,
                swimlane:
                  value === 'all' ? undefined : (value as PipelineSwimlane),
              })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allSwimlanes')}</SelectItem>
              {PIPELINE_SWIMLANES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('filters.country')}>
          <CountrySelect
            className="w-[160px]"
            value={firstValue(filters.country) ?? null}
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
        </FilterField>
        <FilterField label={t('filters.region')}>
          <Select
            value={firstValue(filters.region) ?? 'all'}
            onValueChange={(value) =>
              onChange({
                ...filters,
                region: value === 'all' ? undefined : (value as Region),
              })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allRegions')}</SelectItem>
              {regions.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('filters.accountManager')}>
          <SpaceMemberSelect
            className="w-[180px]"
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
        </FilterField>
        <FilterField label={t('filters.priority')}>
          <Select
            value={firstValue(filters.priority) ?? 'all'}
            onValueChange={(value) =>
              onChange({
                ...filters,
                priority: value === 'all' ? undefined : (value as DealPriority),
              })
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allPriorities')}</SelectItem>
              {DEAL_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {formatPriorityLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('filters.status')}>
          <Select
            value={firstValue(filters.status) ?? 'all'}
            onValueChange={(value) =>
              onChange({
                ...filters,
                status: value === 'all' ? undefined : (value as DealStatus),
              })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue>
                {(() => {
                  const status = firstValue(filters.status);
                  return status
                    ? formatStatusLabel(status)
                    : t('filters.allStatuses');
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
              {DEAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {formatStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('filters.deadline')}>
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
                  value === 'all' ? undefined : value === 'yes' ? true : false,
              })
            }
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.anyDeadline')}</SelectItem>
              <SelectItem value="yes">{t('filters.hasDeadline')}</SelectItem>
              <SelectItem value="no">{t('filters.noDeadline')}</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('filters.tagLabel')}>
          <Input
            className="w-[180px]"
            placeholder={t('filters.tagPlaceholder')}
            value={filters.tag ?? ''}
            onChange={(e) =>
              onChange({ ...filters, tag: e.target.value || undefined })
            }
          />
        </FilterField>
      </div>
    </div>
  );
}
