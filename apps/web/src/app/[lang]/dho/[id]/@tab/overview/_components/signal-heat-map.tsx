'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';

const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const;
const BUCKETS = 6;

type HeatSignal = {
  type: string;
  priority: string;
  createdAt?: string | Date | null;
};

function timeOf(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function priorityOf(value: string): (typeof PRIORITIES)[number] | null {
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
          {Array.from({ length: BUCKETS }, (_, cell) => (
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
  empty,
}: {
  signals: HeatSignal[];
  isLoading: boolean;
  hrefForPriority: (priority: string) => string;
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
      const bucket = Math.min(BUCKETS - 1, Math.floor(age * BUCKETS));
      const key = `${priority}|${bucket}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const peak = Math.max(1, ...counts.values());
    return { counts, peak, hasMarks: counts.size > 0 };
  }, [signals]);

  if (isLoading) return <HeatSkeleton />;
  if (!picture.hasMarks) {
    return <p className="px-5 pb-5 text-2 text-neutral-11">{empty}</p>;
  }

  return (
    <div className="px-5 pb-5">
      <p className="text-1 text-neutral-11">
        {t('openCount', { count: signals.length })}
      </p>
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
              {Array.from({ length: BUCKETS }, (_, column) => {
                const bucket = BUCKETS - 1 - column;
                const count = picture.counts.get(`${priority}|${bucket}`) ?? 0;
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
    </div>
  );
}
