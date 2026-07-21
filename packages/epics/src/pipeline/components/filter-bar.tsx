'use client';

import React from 'react';
import {
  DEAL_PRIORITIES,
  DEAL_STATUSES,
  PIPELINE_SWIMLANES,
  REGIONS,
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
  filters: DealFilters;
  onChange: (filters: DealFilters) => void;
  onExport: () => void;
  savedViewsSlot?: React.ReactNode;
};

export function FilterBar({
  filters,
  onChange,
  onExport,
  savedViewsSlot,
}: FilterBarProps) {
  const t = useTranslations('Pipeline');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onExport}>
          <Download className="mr-1 size-3.5" />
          {t('exportXlsx')}
        </Button>
        {savedViewsSlot}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[180px] max-w-xs"
          placeholder={t('filters.search')}
          value={filters.q ?? ''}
          onChange={(e) =>
            onChange({ ...filters, q: e.target.value || undefined })
          }
        />
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
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('filters.swimlane')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
            {PIPELINE_SWIMLANES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={(filters.region as string) || 'all'}
          onValueChange={(value) =>
            onChange({
              ...filters,
              region:
                value === 'all' ? undefined : (value as DealFilters['region']),
            })
          }
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('filters.region')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
            {REGIONS.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t('filters.priority')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
            {DEAL_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={(filters.status as string) || 'all'}
          onValueChange={(value) =>
            onChange({
              ...filters,
              status:
                value === 'all' ? undefined : (value as DealFilters['status']),
            })
          }
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder={t('filters.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
            {DEAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder={t('filters.deadline')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('filters.all')}</SelectItem>
            <SelectItem value="yes">{t('filters.hasDeadline')}</SelectItem>
            <SelectItem value="no">{t('filters.noDeadline')}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          className="w-[140px]"
          placeholder={t('filters.tag')}
          value={filters.tag ?? ''}
          onChange={(e) =>
            onChange({ ...filters, tag: e.target.value || undefined })
          }
        />
      </div>
    </div>
  );
}
