'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { COHERENCE_TYPES } from '@hypha-platform/core/client';

import './signal-heat-map.css';

const BUCKETS = 4;
const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;

const TYPE_INK: Record<string, string> = {
  Need: 'var(--success-9)',
  Resource: 'var(--neutral-11)',
  Opportunity: 'var(--success-9)',
  Insight: 'var(--info-9)',
  Tension: 'var(--warning-9)',
  Risk: 'var(--error-9)',
  Action: 'var(--accent-11)',
  Impact: 'var(--success-11)',
  Trend: 'var(--warning-11)',
  Proposal: 'var(--accent-11)',
};

type HeatSignal = {
  type: string;
  priority?: string | null;
  createdAt?: string | Date | null;
};

function timeOf(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function HeatField({
  signals,
  ink,
  priorityLabel,
  recent,
  older,
  cellTitle,
}: {
  signals: HeatSignal[];
  ink: string;
  priorityLabel: (priority: (typeof PRIORITIES)[number]) => string;
  recent: string;
  older: string;
  cellTitle: (
    priority: string,
    count: number,
    start: number,
    end: number,
  ) => string;
}) {
  const matrix = useMemo(() => {
    const times = signals
      .map((signal) => timeOf(signal.createdAt))
      .filter((time): time is number => time != null);
    const newest = times.length > 0 ? Math.max(...times) : 0;
    const oldest = times.length > 0 ? Math.min(...times) : 0;
    const span = Math.max(newest - oldest, 1);
    const counts = new Map<string, number>();
    for (const signal of signals) {
      const time = timeOf(signal.createdAt);
      const age = time == null ? 0 : (newest - time) / span;
      const bucket = Math.min(BUCKETS - 1, Math.floor(age * BUCKETS));
      const raw = (signal.priority ?? 'medium').toLowerCase();
      const priority = PRIORITIES.includes(raw as (typeof PRIORITIES)[number])
        ? (raw as (typeof PRIORITIES)[number])
        : 'medium';
      const key = `${priority}|${bucket}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const peak = Math.max(1, ...counts.values());
    return { counts, peak };
  }, [signals]);

  return (
    <div className="mt-3 w-fit max-w-full">
      <div
        className="grid items-center gap-0.5"
        style={{ gridTemplateColumns: 'auto repeat(4, 1.125rem)' }}
      >
        {PRIORITIES.map((priority) => (
          <div key={priority} className="contents">
            <span className="min-w-[4.25rem] pr-2 text-right text-1 text-neutral-11">
              {priorityLabel(priority)}
            </span>
            {Array.from({ length: BUCKETS }, (_, column) => {
              // Older on the left, recent on the right.
              const bucket = BUCKETS - 1 - column;
              const count = matrix.counts.get(`${priority}|${bucket}`) ?? 0;
              const start = Math.round((bucket / BUCKETS) * 100);
              const end = Math.round(((bucket + 1) / BUCKETS) * 100);
              const heat = count / matrix.peak;
              return (
                <span
                  key={bucket}
                  title={cellTitle(priorityLabel(priority), count, start, end)}
                  className={
                    count > 0
                      ? 'signal-heat-cell size-[1.125rem]'
                      : 'size-[1.125rem] bg-neutral-3'
                  }
                  style={
                    count > 0
                      ? {
                          backgroundColor: `color-mix(in srgb, ${ink} ${Math.round(
                            28 + heat * 72,
                          )}%, transparent)`,
                          animationDuration: `${Math.round(
                            3200 - heat * 1400,
                          )}ms`,
                          animationDelay: `${bucket * 120}ms`,
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>
        ))}
      </div>
      <div
        className="mt-1.5 grid text-1 text-neutral-11"
        style={{ gridTemplateColumns: 'auto repeat(4, 1.125rem)' }}
      >
        <span />
        <span>{older}</span>
        <span className="col-span-2" />
        <span className="text-right">{recent}</span>
      </div>
    </div>
  );
}

function HeatSkeleton() {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-5">
      {Array.from({ length: 2 }, (_, map) => (
        <div key={map} className="w-fit">
          <div className="h-3 w-20 bg-muted" />
          <div className="mt-3 grid w-fit grid-cols-4 gap-0.5">
            {Array.from({ length: PRIORITIES.length * BUCKETS }, (_, cell) => (
              <span key={cell} className="size-[1.125rem] bg-neutral-3" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SignalHeatMaps({
  signals,
  isLoading,
  hrefForType,
  empty,
}: {
  signals: HeatSignal[];
  isLoading: boolean;
  hrefForType: (type: string) => string;
  empty: string;
}) {
  const tSignals = useTranslations('CoherenceTab');
  const tHeat = useTranslations('TokenHoldingsDashboard');
  const groups = useMemo(() => {
    const byType = new Map<string, HeatSignal[]>();
    for (const signal of signals) {
      const list = byType.get(signal.type) ?? [];
      list.push(signal);
      byType.set(signal.type, list);
    }
    return COHERENCE_TYPES.flatMap((type) => {
      const items = byType.get(type);
      return items && items.length > 0 ? [{ type, items }] : [];
    });
  }, [signals]);

  if (isLoading) return <HeatSkeleton />;
  if (groups.length === 0) {
    return <p className="text-2 text-neutral-11">{empty}</p>;
  }

  return (
    <div className="flex w-fit max-w-full flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-5">
        {groups.map((group) => {
          const label = tSignals.has(`types.${group.type}` as 'types.Need')
            ? tSignals(`types.${group.type}` as 'types.Need')
            : group.type;
          return (
            <Link
              key={group.type}
              href={hrefForType(group.type)}
              className="block w-fit max-w-full min-w-0 hover:opacity-80"
            >
              <span className="flex w-fit max-w-full items-baseline gap-2">
                <span className="truncate text-1 uppercase tracking-[0.12em] text-muted-foreground">
                  {label}
                </span>
                <span className="shrink-0 text-2 tabular-nums text-foreground">
                  {group.items.length}
                </span>
              </span>
              <HeatField
                signals={group.items}
                ink={TYPE_INK[group.type] ?? 'var(--accent-11)'}
                priorityLabel={(priority) => tSignals(`priorities.${priority}`)}
                recent={tHeat('signals.recent')}
                older={tHeat('signals.older')}
                cellTitle={(priority, cellCount, start, end) =>
                  tHeat('signals.cellTitle', {
                    priority,
                    count: cellCount,
                    start,
                    end,
                  })
                }
              />
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-1 text-neutral-11">
        <span>{tHeat('signals.lowActivity')}</span>
        <span className="h-2 w-8 bg-neutral-4" />
        <span className="h-2 w-8 bg-foreground" />
        <span>{tHeat('signals.highActivity')}</span>
      </div>
    </div>
  );
}
