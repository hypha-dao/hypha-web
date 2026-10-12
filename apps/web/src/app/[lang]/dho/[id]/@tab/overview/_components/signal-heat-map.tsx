'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { COHERENCE_TYPES } from '@hypha-platform/core/client';

const BUCKETS = 4;

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
  priority: string;
  createdAt?: string | Date | null;
};

function timeOf(value: string | Date | null | undefined) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function HeatSkeleton() {
  return (
    <div className="grid gap-2 px-4 py-4">
      {Array.from({ length: 4 }, (_, row) => (
        <div
          key={row}
          className="grid grid-cols-[7rem_repeat(4,minmax(0,1fr))] gap-1"
        >
          <span className="h-8 bg-neutral-3" />
          {Array.from({ length: BUCKETS }, (_, cell) => (
            <span key={cell} className="h-8 bg-neutral-3" />
          ))}
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
    const times = signals
      .map((signal) => timeOf(signal.createdAt))
      .filter((time): time is number => time != null);
    const newest = times.length > 0 ? Math.max(...times) : 0;
    const oldest = times.length > 0 ? Math.min(...times) : 0;
    const span = Math.max(newest - oldest, 1);
    const counts = new Map<string, number>();
    const totals = new Map<string, number>();
    for (const signal of signals) {
      const time = timeOf(signal.createdAt);
      const age = time == null ? 0 : (newest - time) / span;
      const bucket = Math.min(BUCKETS - 1, Math.floor(age * BUCKETS));
      const key = `${signal.type}|${bucket}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      totals.set(signal.type, (totals.get(signal.type) ?? 0) + 1);
    }
    const peak = Math.max(1, ...counts.values());
    const rows = COHERENCE_TYPES.flatMap((type) => {
      const total = totals.get(type) ?? 0;
      return total > 0 ? [{ type, total }] : [];
    });
    return { counts, peak, rows };
  }, [signals]);

  if (isLoading) return <HeatSkeleton />;
  if (groups.rows.length === 0) {
    return <p className="px-4 py-4 text-2 text-neutral-11">{empty}</p>;
  }

  return (
    <div className="px-4 pb-4">
      <div
        className="grid items-center gap-1"
        style={{
          gridTemplateColumns: 'minmax(7rem, 10rem) repeat(4, minmax(0, 1fr))',
        }}
      >
        {groups.rows.map((row) => {
          const label = tSignals.has(`types.${row.type}` as 'types.Need')
            ? tSignals(`types.${row.type}` as 'types.Need')
            : row.type;
          const ink = TYPE_INK[row.type] ?? 'var(--accent-11)';
          return (
            <Link
              key={row.type}
              href={hrefForType(row.type)}
              className="col-span-5 grid grid-cols-subgrid items-center gap-1 hover:bg-foreground/5"
            >
              <span className="flex min-w-0 items-baseline justify-between gap-2 pr-3">
                <span className="truncate text-1 text-foreground">{label}</span>
                <span className="shrink-0 text-1 tabular-nums text-neutral-11">
                  {row.total}
                </span>
              </span>
              {Array.from({ length: BUCKETS }, (_, column) => {
                const bucket = BUCKETS - 1 - column;
                const count = groups.counts.get(`${row.type}|${bucket}`) ?? 0;
                const start = Math.round((bucket / BUCKETS) * 100);
                const end = Math.round(((bucket + 1) / BUCKETS) * 100);
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
                              28 + (count / groups.peak) * 72,
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
          gridTemplateColumns: 'minmax(7rem, 10rem) repeat(4, minmax(0, 1fr))',
        }}
      >
        <span />
        <span>{tHeat('signals.older')}</span>
        <span className="col-span-2" />
        <span className="text-right">{tHeat('signals.recent')}</span>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-3 text-1 text-neutral-11">
        <span>{tHeat('signals.lowActivity')}</span>
        <span className="h-2 w-10 bg-neutral-4" />
        <span className="h-2 w-10 bg-foreground" />
        <span>{tHeat('signals.highActivity')}</span>
      </div>
    </div>
  );
}
