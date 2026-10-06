'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  hasActiveSignalFilters,
  type Person,
  type SignalBoardFilters,
  type SignalDeadlineFilterMode,
} from '@hypha-platform/core/client';
import {
  Button,
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { X } from 'lucide-react';

type SignalFilterBarProps = {
  filters: SignalBoardFilters;
  onChange: (filters: SignalBoardFilters) => void;
  existingTags: string[];
  members: Person[];
  currentPersonId?: number | null;
};

const DEADLINE_MODES: SignalDeadlineFilterMode[] = [
  'before',
  'after',
  'between',
  'overdue',
  'none',
];

export function SignalFilterBar({
  filters,
  onChange,
  existingTags,
  members,
  currentPersonId,
}: SignalFilterBarProps) {
  const t = useTranslations('CoherenceTab');
  const active = hasActiveSignalFilters(filters);
  const deadlineMode = filters.deadline?.mode;
  const from =
    filters.deadline && 'from' in filters.deadline
      ? filters.deadline.from
      : filters.deadline && 'date' in filters.deadline
      ? filters.deadline.date
      : '';
  const to =
    filters.deadline && 'to' in filters.deadline
      ? filters.deadline.to
      : filters.deadline && 'date' in filters.deadline
      ? filters.deadline.date
      : '';

  const assigneeValue =
    filters.assignee == null || filters.assignee === 'any'
      ? 'any'
      : String(filters.assignee);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('filterTitle')}
          </span>
          <Input
            type="search"
            value={filters.title ?? ''}
            placeholder={t('filterTitlePlaceholder')}
            onChange={(event) =>
              onChange({
                ...filters,
                title: event.target.value || undefined,
              })
            }
          />
        </label>
        <label className="flex min-w-[11rem] flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('filterAssignee')}
          </span>
          <Select
            value={assigneeValue}
            onValueChange={(value) =>
              onChange({
                ...filters,
                assignee:
                  value === 'any'
                    ? undefined
                    : value === 'me'
                    ? 'me'
                    : Number.parseInt(value, 10),
              })
            }
          >
            <SelectTrigger className="w-[11rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('filterAssigneeAny')}</SelectItem>
              {currentPersonId ? (
                <SelectItem value="me">{t('filterAssignedToMe')}</SelectItem>
              ) : null}
              {members.map((member) => (
                <SelectItem key={member.id} value={String(member.id)}>
                  {[member.name, member.surname].filter(Boolean).join(' ') ||
                    member.nickname ||
                    t('signalAssigneeUnknown')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('filterDeadline')}
          </span>
          <Select
            value={deadlineMode ?? 'any'}
            onValueChange={(value) => {
              if (value === 'any') {
                const next = { ...filters };
                delete next.deadline;
                onChange(next);
                return;
              }
              if (value === 'overdue' || value === 'none') {
                onChange({ ...filters, deadline: { mode: value } });
                return;
              }
              if (value === 'between') {
                onChange({
                  ...filters,
                  deadline: {
                    mode: 'between',
                    from: from || to,
                    to: to || from,
                  },
                });
                return;
              }
              onChange({
                ...filters,
                deadline: {
                  mode: value as 'before' | 'after',
                  date: to || from,
                },
              });
            }}
          >
            <SelectTrigger className="w-[10rem]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t('filterDeadlineAny')}</SelectItem>
              {DEADLINE_MODES.map((mode) => (
                <SelectItem key={mode} value={mode}>
                  {t(`filterDeadline_${mode}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {deadlineMode === 'before' || deadlineMode === 'after' ? (
          <label className="flex min-w-[9rem] flex-col gap-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {deadlineMode === 'after'
                ? t('filterDeadlineFrom')
                : t('filterDeadlineTo')}
            </span>
            <Input
              type="date"
              value={deadlineMode === 'after' ? from : to}
              onChange={(event) => {
                const date = event.target.value;
                onChange({
                  ...filters,
                  deadline: date
                    ? { mode: deadlineMode, date }
                    : { mode: deadlineMode },
                });
              }}
            />
          </label>
        ) : null}
        {deadlineMode === 'between' ? (
          <>
            <label className="flex min-w-[9rem] flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('filterDeadlineFrom')}
              </span>
              <Input
                type="date"
                value={from}
                onChange={(event) => {
                  const date = event.target.value;
                  onChange({
                    ...filters,
                    deadline: {
                      mode: 'between',
                      from: date || undefined,
                      to: to || undefined,
                    },
                  });
                }}
              />
            </label>
            <label className="flex min-w-[9rem] flex-col gap-1">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t('filterDeadlineTo')}
              </span>
              <Input
                type="date"
                value={to}
                onChange={(event) => {
                  const date = event.target.value;
                  onChange({
                    ...filters,
                    deadline: {
                      mode: 'between',
                      from: from || undefined,
                      to: date || undefined,
                    },
                  });
                }}
              />
            </label>
          </>
        ) : null}
        <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t('filterTags')}
          </span>
          <MultiSelect
            options={existingTags.map((tag) => ({ value: tag, label: tag }))}
            value={filters.tags ?? []}
            allowCreate={false}
            allowToggleAll={false}
            maxCount={2}
            placeholder={t('filterTagsPlaceholder')}
            searchPlaceholder={t('searchOrCreateTag')}
            onValueChange={(tags) =>
              onChange({
                ...filters,
                tags: tags.length > 0 ? tags : undefined,
              })
            }
          />
        </div>
        {currentPersonId ? (
          <Button
            type="button"
            variant={filters.assignee === 'me' ? 'default' : 'outline'}
            colorVariant={filters.assignee === 'me' ? 'accent' : 'neutral'}
            size="sm"
            onClick={() =>
              onChange({
                ...filters,
                assignee: filters.assignee === 'me' ? undefined : 'me',
              })
            }
          >
            {t('filterAssignedToMe')}
          </Button>
        ) : null}
      </div>
      {active ? (
        <div className="flex items-center justify-between gap-2 rounded-none border border-border/70 bg-muted/30 px-3 py-1.5 text-sm">
          <span>{t('filtersActive')}</span>
          <Button
            type="button"
            variant="ghost"
            colorVariant="neutral"
            size="sm"
            className="h-7 px-2"
            onClick={() => onChange({})}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            {t('filtersClear')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
