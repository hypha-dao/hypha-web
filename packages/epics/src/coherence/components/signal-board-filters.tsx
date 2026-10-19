'use client';

import React, { type ReactNode } from 'react';
import { Check, ListFilter, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import {
  COHERENCE_SIGNAL_TYPES,
  type CoherenceSignalType,
  type Person,
  type SignalBoardFilters as BoardFilters,
} from '@hypha-platform/core/client';
import { personRosterDisplayLabel } from '../../common/human-chat-panel/build-space-roster-mention-candidates';
import { SignalMenuFilters, SignalTitleSearch } from './signal-filter-bar';
import { Popover, PopoverContent, PopoverTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

export const SIGNAL_PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

export type SignalPriority = (typeof SIGNAL_PRIORITIES)[number];

type SignalBoardFiltersProps = {
  typeFilters: readonly CoherenceSignalType[];
  priorityFilters: readonly SignalPriority[];
  typeCounts: { all: number } & Record<CoherenceSignalType, number>;
  priorityCounts: Record<'all' | SignalPriority, number>;
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

function toggleValue<T extends string>(
  current: readonly T[],
  value: T,
  order: readonly T[],
): T[] {
  const next = new Set(current);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return order.filter((item) => next.has(item));
}

function FilterOption({
  label,
  count,
  selected,
  onSelect,
}: {
  label: string;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const format = useFormatter();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-3 px-3 py-2 text-left text-2',
        selected
          ? 'bg-muted/70 text-foreground'
          : 'text-foreground hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'flex size-4 shrink-0 items-center justify-center border',
          selected
            ? 'border-foreground bg-foreground text-background'
            : 'border-border bg-background',
        )}
        aria-hidden
      >
        {selected ? <Check className="size-3" strokeWidth={2} /> : null}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <span className="text-1 tabular-nums text-neutral-11">
        {format.number(count)}
      </span>
    </button>
  );
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
      className="inline-flex h-8 items-center gap-1.5 border border-border bg-background px-2 text-1 text-foreground hover:border-foreground"
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
  typeCounts,
  priorityCounts,
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
                  'inline-flex h-10 w-10 shrink-0 items-center justify-center border bg-background text-muted-foreground hover:text-foreground',
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
              <section className="border-b border-border py-2">
                <p className="px-3 py-1 text-1 uppercase tracking-[0.12em] text-neutral-11">
                  {t('type')}
                </p>
                <div className="grid">
                  <FilterOption
                    label={t('all')}
                    count={typeCounts.all}
                    selected={typeFilters.length === 0}
                    onSelect={() => writeParam('type', [])}
                  />
                  {COHERENCE_SIGNAL_TYPES.map((type) => (
                    <FilterOption
                      key={type}
                      label={t(`types.${type}` as 'types.Need')}
                      count={typeCounts[type] ?? 0}
                      selected={typeFilters.includes(type)}
                      onSelect={() =>
                        writeParam(
                          'type',
                          toggleValue(
                            typeFilters,
                            type,
                            COHERENCE_SIGNAL_TYPES,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              </section>
              <section className="border-b border-border py-2">
                <p className="px-3 py-1 text-1 uppercase tracking-[0.12em] text-neutral-11">
                  {t('priority')}
                </p>
                <div className="grid">
                  <FilterOption
                    label={t('all')}
                    count={priorityCounts.all}
                    selected={priorityFilters.length === 0}
                    onSelect={() => writeParam('priority', [])}
                  />
                  {SIGNAL_PRIORITIES.map((priority) => (
                    <FilterOption
                      key={priority}
                      label={t(`priorities.${priority}`)}
                      count={priorityCounts[priority]}
                      selected={priorityFilters.includes(priority)}
                      onSelect={() =>
                        writeParam(
                          'priority',
                          toggleValue(
                            priorityFilters,
                            priority,
                            SIGNAL_PRIORITIES,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              </section>
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
