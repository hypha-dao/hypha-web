'use client';

import React from 'react';
import { ListFilter, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { COHERENCE_SIGNAL_TYPES } from '@hypha-platform/core/client';
import { Popover, PopoverContent, PopoverTrigger } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

type PriorityFilter = 'all' | (typeof PRIORITIES)[number];

type SignalBoardFiltersProps = {
  typeFilter: string;
  priorityFilter: PriorityFilter;
  typeCounts: { all: number } & Record<
    (typeof COHERENCE_SIGNAL_TYPES)[number],
    number
  >;
  priorityCounts: Record<PriorityFilter, number>;
};

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
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-center justify-between gap-3 px-2 py-2 text-left text-1 uppercase tracking-[0.12em]',
        selected ? 'text-foreground' : 'text-neutral-11 hover:text-foreground',
      )}
    >
      <span>{label}</span>
      <span className="text-neutral-11">{format.number(count)}</span>
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
      className="inline-flex h-10 items-center gap-2 border border-foreground bg-background px-3 text-1 uppercase tracking-[0.12em] text-foreground"
    >
      <span>{label}</span>
      <X className="size-3 shrink-0" strokeWidth={1.25} aria-hidden />
    </button>
  );
}

export function SignalBoardFilters({
  typeFilter,
  priorityFilter,
  typeCounts,
  priorityCounts,
}: SignalBoardFiltersProps) {
  const t = useTranslations('CoherenceTab');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = typeFilter !== 'all' || priorityFilter !== 'all';

  const setParam = React.useCallback(
    (key: 'type' | 'priority', value: string) => {
      const nextParams = new URLSearchParams(searchParams.toString());
      if (value === 'all') {
        nextParams.delete(key);
      } else {
        nextParams.set(key, value);
      }
      const query = nextParams.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const typeLabel =
    typeFilter !== 'all'
      ? t.has(`types.${typeFilter}` as 'types.Need')
        ? t(`types.${typeFilter}` as 'types.Need')
        : typeFilter
      : null;
  const priorityLabel =
    priorityFilter === 'all' ? null : t(`priorities.${priorityFilter}`);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t('filter')}
            title={t('filter')}
            className={cn(
              'inline-flex h-10 w-10 shrink-0 items-center justify-center border bg-background text-muted-foreground hover:text-foreground',
              active ? 'border-foreground text-foreground' : 'border-border/70',
            )}
          >
            <ListFilter className="craft-icon" strokeWidth={1.25} aria-hidden />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 rounded-none border-border bg-background p-0 text-foreground shadow-none"
        >
          <section className="border-b border-border px-2 py-3">
            <p className="px-2 text-1 uppercase tracking-[0.12em] text-neutral-11">
              {t('type')}
            </p>
            <div className="mt-1 grid">
              {COHERENCE_SIGNAL_TYPES.map((type) => (
                <FilterOption
                  key={type}
                  label={t(`types.${type}` as 'types.Need')}
                  count={typeCounts[type] ?? 0}
                  selected={typeFilter === type}
                  onSelect={() =>
                    setParam('type', typeFilter === type ? 'all' : type)
                  }
                />
              ))}
            </div>
          </section>
          <section className="px-2 py-3">
            <p className="px-2 text-1 uppercase tracking-[0.12em] text-neutral-11">
              {t('priority')}
            </p>
            <div className="mt-1 grid">
              {PRIORITIES.map((priority) => (
                <FilterOption
                  key={priority}
                  label={t(`priorities.${priority}`)}
                  count={priorityCounts[priority]}
                  selected={priorityFilter === priority}
                  onSelect={() =>
                    setParam(
                      'priority',
                      priorityFilter === priority ? 'all' : priority,
                    )
                  }
                />
              ))}
            </div>
          </section>
        </PopoverContent>
      </Popover>
      {typeLabel ? (
        <FilterTag label={typeLabel} onRemove={() => setParam('type', 'all')} />
      ) : null}
      {priorityLabel ? (
        <FilterTag
          label={priorityLabel}
          onRemove={() => setParam('priority', 'all')}
        />
      ) : null}
    </div>
  );
}
