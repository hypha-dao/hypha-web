'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { COHERENCE_TYPES } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
const PRIORITY_BUCKETS = 6;
const CATEGORY_BUCKETS = 4;

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

function priorityOf(
  value: string | null | undefined,
): (typeof PRIORITIES)[number] | null {
  if (!value) return null;
  return (
    PRIORITIES.find((priority) => priority === value.toLowerCase()) ?? null
  );
}

function HeatSkeleton() {
  return (
    <div className="grid gap-2 px-5 pb-5">
      {Array.from({ length: 4 }, (_, row) => (
        <div
          key={row}
          className="grid grid-cols-[5.5rem_repeat(6,minmax(0,1fr))] gap-1"
        >
          <span className="h-6 bg-neutral-3" />
          {Array.from({ length: PRIORITY_BUCKETS }, (_, cell) => (
            <span key={cell} className="h-6 bg-neutral-3" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SignalHeatMaps({
  signals,
  isLoading,
  hrefForPriority,
  hrefForType,
  empty,
}: {
  signals: HeatSignal[];
  isLoading: boolean;
  hrefForPriority: (priority: string) => string;
  hrefForType: (type: string) => string;
  empty: string;
}) {
  const tSignals = useTranslations('CoherenceTab');
  const tHeat = useTranslations('TokenHoldingsDashboard');
  const t = useTranslations('OverviewOps');
  const picture = useMemo(() => {
    const times = signals
      .map((signal) => timeOf(signal.createdAt))
      .filter((time): time is number => time != null);
    const newest = times.length > 0 ? Math.max(...times) : 0;
    const oldest = times.length > 0 ? Math.min(...times) : 0;
    const span = Math.max(newest - oldest, 1);
    const counts = new Map<string, number>();
    for (const signal of signals) {
      const priority = priorityOf(signal.priority);
      if (!priority) continue;
      const time = timeOf(signal.createdAt);
      const age = time == null ? 0 : (newest - time) / span;
      const bucket = Math.min(
        PRIORITY_BUCKETS - 1,
        Math.floor(age * PRIORITY_BUCKETS),
      );
      const key = `${priority}|${bucket}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const peak = Math.max(1, ...counts.values());
    const categoryCounts = new Map<string, number>();
    const categoryTotals = new Map<string, number>();
    for (const signal of signals) {
      const time = timeOf(signal.createdAt);
      const age = time == null ? 0 : (newest - time) / span;
      const bucket = Math.min(
        CATEGORY_BUCKETS - 1,
        Math.floor(age * CATEGORY_BUCKETS),
      );
      const key = `${signal.type}|${bucket}`;
      categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
      categoryTotals.set(
        signal.type,
        (categoryTotals.get(signal.type) ?? 0) + 1,
      );
    }
    const categoryPeak = Math.max(1, ...categoryCounts.values());
    const categories = COHERENCE_TYPES.flatMap((type) => {
      const total = categoryTotals.get(type) ?? 0;
      return total > 0 ? [{ type, total }] : [];
    });
    return {
      counts,
      peak,
      hasMarks: counts.size > 0,
      categoryCounts,
      categoryPeak,
      categories,
    };
  }, [signals]);

  if (isLoading) return <HeatSkeleton />;
  if (!picture.hasMarks && picture.categories.length === 0) {
    return <p className="px-5 pb-5 text-2 text-neutral-11">{empty}</p>;
  }

  return (
    <div className="px-5 pb-5">
      <p className="text-1 text-neutral-11">
        {t('openCount', { count: signals.length })}
      </p>
      {picture.hasMarks ? (
        <>
          <div
            className="mt-4 grid items-center gap-1"
            style={{
              gridTemplateColumns:
                'minmax(5.5rem, 7.5rem) repeat(6, minmax(0, 1fr))',
            }}
          >
            {PRIORITIES.map((priority) => {
              const key = `priorities.${priority}` as 'priorities.critical';
              const label = tSignals.has(key) ? tSignals(key) : priority;
              return (
                <Link
                  key={priority}
                  href={hrefForPriority(priority)}
                  className="col-span-7 grid grid-cols-subgrid items-center gap-1 hover:bg-foreground/5"
                  aria-label={label}
                >
                  <span className="truncate pr-3 text-1 text-foreground">
                    {label}
                  </span>
                  {Array.from({ length: PRIORITY_BUCKETS }, (_, column) => {
                    const bucket = PRIORITY_BUCKETS - 1 - column;
                    const count =
                      picture.counts.get(`${priority}|${bucket}`) ?? 0;
                    return (
                      <span
                        key={bucket}
                        title={`${label} ${count}`}
                        className={cn('h-6', count === 0 && 'bg-neutral-3')}
                        style={
                          count > 0
                            ? {
                                backgroundColor: `color-mix(in srgb, var(--foreground) ${Math.round(
                                  22 + (count / picture.peak) * 78,
                                )}%, transparent)`,
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </Link>
              );
            })}
          </div>
          <div
            className="mt-2 grid text-1 text-neutral-11"
            style={{
              gridTemplateColumns:
                'minmax(5.5rem, 7.5rem) repeat(6, minmax(0, 1fr))',
            }}
          >
            <span />
            <span>{tHeat('signals.older')}</span>
            <span className="col-span-4" />
            <span className="text-right">{tHeat('signals.recent')}</span>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2 text-1 text-neutral-11">
            <span>{tHeat('signals.lowActivity')}</span>
            <span className="h-2 w-8 bg-neutral-4" />
            <span className="h-2 w-8 bg-foreground" />
            <span>{tHeat('signals.highActivity')}</span>
          </div>
        </>
      ) : null}
      {picture.categories.length > 0 ? (
        <div
          className={
            picture.hasMarks ? 'mt-6 border-t border-border pt-5' : 'mt-4'
          }
        >
          <p className="text-1 text-neutral-11">{tSignals('type')}</p>
          <div
            className="mt-3 grid items-center gap-1"
            style={{
              gridTemplateColumns:
                'minmax(7rem, 10rem) repeat(4, minmax(0, 1fr))',
            }}
          >
            {picture.categories.map((row) => {
              const typeKey = `types.${row.type}` as 'types.Need';
              const label = tSignals.has(typeKey)
                ? tSignals(typeKey)
                : row.type;
              const ink = TYPE_INK[row.type] ?? 'var(--accent-11)';
              return (
                <Link
                  key={row.type}
                  href={hrefForType(row.type)}
                  className="col-span-5 grid grid-cols-subgrid items-center gap-1 hover:bg-foreground/5"
                >
                  <span className="flex min-w-0 items-baseline justify-between gap-2 pr-3">
                    <span className="truncate text-1 text-foreground">
                      {label}
                    </span>
                    <span className="shrink-0 text-1 tabular-nums text-neutral-11">
                      {row.total}
                    </span>
                  </span>
                  {Array.from({ length: CATEGORY_BUCKETS }, (_, column) => {
                    const bucket = CATEGORY_BUCKETS - 1 - column;
                    const count =
                      picture.categoryCounts.get(`${row.type}|${bucket}`) ?? 0;
                    const start = Math.round((bucket / CATEGORY_BUCKETS) * 100);
                    const end = Math.round(
                      ((bucket + 1) / CATEGORY_BUCKETS) * 100,
                    );
                    return (
                      <span
                        key={bucket}
                        title={tHeat('signals.cellTitle', {
                          priority: label,
                          count,
                          start,
                          end,
                        })}
                        className={
                          count > 0
                            ? 'h-8 bg-neutral-3 motion-safe:animate-pulse [animation-duration:2.8s]'
                            : 'h-8 bg-neutral-3'
                        }
                        style={
                          count > 0
                            ? {
                                backgroundColor: `color-mix(in srgb, ${ink} ${Math.round(
                                  28 + (count / picture.categoryPeak) * 72,
                                )}%, transparent)`,
                              }
                            : undefined
                        }
                      />
                    );
                  })}
                </Link>
              );
            })}
          </div>
          <div
            className="mt-2 grid text-1 text-neutral-11"
            style={{
              gridTemplateColumns:
                'minmax(7rem, 10rem) repeat(4, minmax(0, 1fr))',
            }}
          >
            <span />
            <span>{tHeat('signals.older')}</span>
            <span className="col-span-2" />
            <span className="text-right">{tHeat('signals.recent')}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
