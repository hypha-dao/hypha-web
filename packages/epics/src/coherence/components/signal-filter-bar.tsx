'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  type Person,
  type SignalBoardFilters,
  type SignalDeadlineFilterMode,
} from '@hypha-platform/core/client';
import {
  Input,
  MultiSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { SpaceMemberSelect } from '../../pipeline/components/space-member-select';
import { useDebouncedBoardTitle } from '../lib/use-debounced-board-title';
import {
  SIGNAL_BOARD_SELECT_TEXT_CLASS,
  SIGNAL_FILTER_MULTI_SELECT_CLASS,
} from '../utils/signal-tag-badge-styles';

type SignalFilterBarProps = {
  filters: SignalBoardFilters;
  onChange: (filters: SignalBoardFilters) => void;
  existingTags: string[];
  members: Person[];
  currentPersonId?: number | null;
};

export const SignalTitleSearch = React.memo(function SignalTitleSearch({
  filters,
  onChange,
}: Pick<SignalFilterBarProps, 'filters' | 'onChange'>) {
  const t = useTranslations('CoherenceTab');
  const { titleInput, onTitleChange } = useDebouncedBoardTitle({
    filters,
    onChange,
  });

  return (
    <Input
      type="search"
      value={titleInput}
      placeholder={t('filterTitlePlaceholder')}
      aria-label={t('filterTitle')}
      onChange={(event) => onTitleChange(event.target.value)}
      className="h-10 min-w-0 flex-1"
    />
  );
});

const DEADLINE_MODES: SignalDeadlineFilterMode[] = [
  'before',
  'after',
  'between',
  'overdue',
  'none',
];

export const SignalMenuFilters = React.memo(function SignalMenuFilters({
  filters,
  onChange,
  existingTags,
  members,
  currentPersonId,
}: SignalFilterBarProps) {
  const t = useTranslations('CoherenceTab');
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
      ? null
      : String(filters.assignee);

  return (
    <div className="grid gap-3 px-3 py-3">
      <label className="grid gap-1">
        <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('filterAssignee')}
        </span>
        <SpaceMemberSelect
          className="h-10 w-full"
          members={members}
          value={assigneeValue}
          onChange={(id) => {
            if (id == null) {
              onChange({ ...filters, assignee: undefined });
              return;
            }
            if (id === 'me') {
              onChange({ ...filters, assignee: 'me' });
              return;
            }
            const parsed = Number.parseInt(id, 10);
            onChange({
              ...filters,
              assignee:
                Number.isInteger(parsed) && parsed > 0 ? parsed : undefined,
            });
          }}
          unassignedLabel={t('filterAssigneeAny')}
          leadingOptions={
            currentPersonId
              ? [{ value: 'me', label: t('filterAssignedToMe') }]
              : []
          }
          searchPlaceholder={t('filterAssigneeSearch')}
          emptyListMessage={t('filterAssigneeEmpty')}
          unknownLabel={t('signalAssigneeUnknown')}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
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
          <SelectTrigger className="w-full">
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
        <label className="grid gap-1">
          <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
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
          <label className="grid gap-1">
            <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
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
          <label className="grid gap-1">
            <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
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
      <div className="grid gap-1">
        <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
          {t('filterTags')}
        </span>
        <MultiSelect
          options={existingTags.map((tag) => ({ value: tag, label: tag }))}
          value={filters.tags ?? []}
          allowCreate={false}
          allowToggleAll={false}
          showFullSelection
          placeholder={t('filterTagsPlaceholder')}
          searchPlaceholder={t('searchOrCreateTag')}
          textClassName={SIGNAL_BOARD_SELECT_TEXT_CLASS}
          className={cn(
            SIGNAL_BOARD_SELECT_TEXT_CLASS,
            SIGNAL_FILTER_MULTI_SELECT_CLASS,
          )}
          onValueChange={(tags) =>
            onChange({
              ...filters,
              tags: tags.length > 0 ? tags : undefined,
            })
          }
        />
      </div>
    </div>
  );
});
