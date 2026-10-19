'use client';

import React, { type ReactNode } from 'react';
import { ListFilter, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  COHERENCE_SIGNAL_TYPES,
  type CoherenceSignalType,
  type Person,
  type SignalBoardFilters as BoardFilters,
} from '@hypha-platform/core/client';
import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import { SignalMenuFilters, SignalTitleSearch } from './signal-filter-bar';
import {
  SIGNAL_BOARD_SELECT_TEXT_CLASS,
  SIGNAL_FILTER_MULTI_SELECT_CLASS,
} from '../utils/signal-tag-badge-styles';
import {
  MultiSelect,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export const SIGNAL_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export type SignalPriority = (typeof SIGNAL_PRIORITIES)[number];

type SignalBoardFiltersProps = {
  typeFilters: readonly CoherenceSignalType[];
  priorityFilters: readonly SignalPriority[];
  boardFilters: BoardFilters;
  onBoardFiltersChange: (filters: BoardFilters) => void;
  existingTags: string[];
  members: Person[];
  currentPersonId?: number | null;
  /** Add, view, and archive controls. They stay on the search row. */
  controls?: ReactNode;
};

function parseAllowed<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T[] {
  if (!raw) return [];
  const allowedSet = new Set<string>(allowed);
  const seen = new Set<string>();
  const selected: T[] = [];
  for (const part of raw.split(',')) {
    const value = part.trim();
    if (!allowedSet.has(value) || seen.has(value)) continue;
    seen.add(value);
    selected.push(value as T);
  }
  return allowed.filter((value) => seen.has(value));
}

export function parseSignalTypeFilters(
  raw: string | null,
): CoherenceSignalType[] {
  return parseAllowed(raw, COHERENCE_SIGNAL_TYPES);
}

export function parseSignalPriorityFilters(
  raw: string | null,
): SignalPriority[] {
  return parseAllowed(raw, SIGNAL_PRIORITIES);
}

function FilterTag({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const t = useTranslations('CoherenceTab');
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

function formatFilterDay(iso: string | undefined): string | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function deadlineChipLabel(
  deadline: NonNullable<BoardFilters['deadline']>,
  modeLabel: string,
): string {
  if (deadline.mode === 'before' || deadline.mode === 'after') {
    const day = formatFilterDay(deadline.date);
    return day ? `${modeLabel} ${day}` : modeLabel;
  }
  if (deadline.mode === 'between') {
    const range = [deadline.from, deadline.to]
      .map((iso) => formatFilterDay(iso))
      .filter((day): day is string => day != null)
      .join(' – ');
    return range ? `${modeLabel} ${range}` : modeLabel;
  }
  return modeLabel;
}

export function SignalBoardFilters({
  typeFilters,
  priorityFilters,
  boardFilters,
  onBoardFiltersChange,
  existingTags,
  members,
  currentPersonId,
  controls,
}: SignalBoardFiltersProps) {
  const t = useTranslations('CoherenceTab');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const boardActive =
    (boardFilters.assignee != null && boardFilters.assignee !== 'any') ||
    boardFilters.deadline != null ||
    (boardFilters.tags ?? []).some((tag) => tag.trim().length > 0);
  const active =
    typeFilters.length > 0 || priorityFilters.length > 0 || boardActive;

  const writeParam = React.useCallback(
    (key: 'type' | 'priority', values: readonly string[]) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (values.length === 0) nextParams.delete(key);
      else nextParams.set(key, values.join(','));
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const clearFilters = React.useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('type');
    nextParams.delete('priority');
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router, searchParams]);

  const assigneeLabel =
    boardFilters.assignee === 'me'
      ? t('filterAssignedToMe')
      : typeof boardFilters.assignee === 'number'
      ? (() => {
          const member = members.find(
            (person) => person.id === boardFilters.assignee,
          );
          return member
            ? personRosterDisplayLabel(member, t('signalAssigneeUnknown'))
            : t('signalAssigneeUnknown');
        })()
      : null;
  const deadlineLabel = boardFilters.deadline
    ? deadlineChipLabel(
        boardFilters.deadline,
        t(`filterDeadline_${boardFilters.deadline.mode}`),
      )
    : null;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="flex min-w-[14rem] flex-1 items-center gap-2">
          <SignalTitleSearch
            filters={boardFilters}
            onChange={onBoardFiltersChange}
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
              align="start"
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
              <div className="grid gap-3 border-b border-border px-3 py-3">
                <label className="grid gap-1">
                  <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                    {t('type')}
                  </span>
                  <MultiSelect
                    options={COHERENCE_SIGNAL_TYPES.map((type) => ({
                      value: type,
                      label: t(`types.${type}` as 'types.Need'),
                    }))}
                    value={[...typeFilters]}
                    allowCreate={false}
                    allowToggleAll={false}
                    showFullSelection
                    placeholder={t('filterTypesPlaceholder')}
                    searchPlaceholder={t('filterOptionSearch')}
                    textClassName={SIGNAL_BOARD_SELECT_TEXT_CLASS}
                    className={cn(
                      SIGNAL_BOARD_SELECT_TEXT_CLASS,
                      SIGNAL_FILTER_MULTI_SELECT_CLASS,
                    )}
                    onValueChange={(values) =>
                      writeParam(
                        'type',
                        COHERENCE_SIGNAL_TYPES.filter((type) =>
                          values.includes(type),
                        ),
                      )
                    }
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-1 uppercase tracking-[0.12em] text-neutral-11">
                    {t('priority')}
                  </span>
                  <MultiSelect
                    options={SIGNAL_PRIORITIES.map((priority) => ({
                      value: priority,
                      label: t(`priorities.${priority}`),
                    }))}
                    value={[...priorityFilters]}
                    allowCreate={false}
                    allowToggleAll={false}
                    showFullSelection
                    placeholder={t('filterPrioritiesPlaceholder')}
                    searchPlaceholder={t('filterOptionSearch')}
                    textClassName={SIGNAL_BOARD_SELECT_TEXT_CLASS}
                    className={cn(
                      SIGNAL_BOARD_SELECT_TEXT_CLASS,
                      SIGNAL_FILTER_MULTI_SELECT_CLASS,
                    )}
                    onValueChange={(values) =>
                      writeParam(
                        'priority',
                        SIGNAL_PRIORITIES.filter((priority) =>
                          values.includes(priority),
                        ),
                      )
                    }
                  />
                </label>
              </div>
              <SignalMenuFilters
                filters={boardFilters}
                onChange={onBoardFiltersChange}
                existingTags={existingTags}
                members={members}
                currentPersonId={currentPersonId}
              />
              {active ? (
                <div className="flex justify-end border-t border-border px-3 py-2">
                  <button
                    type="button"
                    onClick={() => {
                      clearFilters();
                      onBoardFiltersChange({});
                    }}
                    className="text-1 text-neutral-11 hover:text-foreground"
                  >
                    {t('reset')}
                  </button>
                </div>
              ) : null}
            </PopoverContent>
          </Popover>
        </div>
        {controls}
      </div>
      {active ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {typeFilters.map((type) => (
            <FilterTag
              key={type}
              label={t(`types.${type}` as 'types.Need')}
              onRemove={() =>
                writeParam(
                  'type',
                  typeFilters.filter((value) => value !== type),
                )
              }
            />
          ))}
          {priorityFilters.map((priority) => (
            <FilterTag
              key={priority}
              label={t(`priorities.${priority}`)}
              onRemove={() =>
                writeParam(
                  'priority',
                  priorityFilters.filter((value) => value !== priority),
                )
              }
            />
          ))}
          {assigneeLabel ? (
            <FilterTag
              label={assigneeLabel}
              onRemove={() =>
                onBoardFiltersChange({ ...boardFilters, assignee: undefined })
              }
            />
          ) : null}
          {deadlineLabel ? (
            <FilterTag
              label={deadlineLabel}
              onRemove={() => {
                const next = { ...boardFilters };
                delete next.deadline;
                onBoardFiltersChange(next);
              }}
            />
          ) : null}
          {(boardFilters.tags ?? []).map((tag) => (
            <FilterTag
              key={tag}
              label={tag}
              onRemove={() =>
                onBoardFiltersChange({
                  ...boardFilters,
                  tags: (boardFilters.tags ?? []).filter(
                    (value) => value !== tag,
                  ),
                })
              }
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
