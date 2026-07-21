'use client';

import React from 'react';
import {
  DEAL_PRIORITIES,
  DEAL_STATUSES,
  PIPELINE_SWIMLANES,
  usePipelineConfig,
  type DealFilters,
  type PipelineSwimlane,
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

type FilterBarProps = {
  spaceSlug: string;
  filters: DealFilters;
  onChange: (filters: DealFilters) => void;
  onExport: () => void;
  savedViewsSlot?: React.ReactNode;
};

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-[140px] flex-col gap-1">
      <span className="text-1 text-neutral-11">{label}</span>
      {children}
    </label>
  );
}

export function FilterBar({
  spaceSlug,
  filters,
  onChange,
  onExport,
  savedViewsSlot,
}: FilterBarProps) {
  const t = useTranslations('Pipeline');
  const { regions } = usePipelineConfig(spaceSlug);

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
            value={(filters.swimlane as string) || 'all'}
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
        <FilterField label={t('filters.region')}>
          <Select
            value={(filters.region as string) || 'all'}
            onValueChange={(value) =>
              onChange({
                ...filters,
                region:
                  value === 'all'
                    ? undefined
                    : (value as DealFilters['region']),
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
        <FilterField label={t('filters.priority')}>
          <Select
            value={(filters.priority as string) || 'all'}
            onValueChange={(value) =>
              onChange({
                ...filters,
                priority:
                  value === 'all'
                    ? undefined
                    : (value as DealFilters['priority']),
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
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label={t('filters.status')}>
          <Select
            value={(filters.status as string) || 'all'}
            onValueChange={(value) =>
              onChange({
                ...filters,
                status:
                  value === 'all'
                    ? undefined
                    : (value as DealFilters['status']),
              })
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allStatuses')}</SelectItem>
              {DEAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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
