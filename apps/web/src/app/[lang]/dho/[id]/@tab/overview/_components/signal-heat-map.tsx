'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { COHERENCE_TYPES } from '@hypha-platform/core/client';

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
  priority: string;
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
      const priority = PRIORITIES.includes(
        signal.priority as (typeof PRIORITIES)[number],
      )
        ? signal.priority
        : 'medium';
      const key = `${priority}|${bucket}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const peak = Math.max(1, ...counts.values());
    return { counts, peak };
  }, [signals]);

  return (
    <div className="mt-4">
      <div
        className="grid items-center gap-1"
        style={{ gridTemplateColumns: 'auto repeat(4, minmax(0, 1fr))' }}
      >
        {PRIORITIES.map((priority) => (
          <div key={priority} className="contents">
            <span className="pr-2 text-1 text-neutral-11">
              {priorityLabel(priority)}
            </span>
            {Array.from({ length: BUCKETS }, (_, column) => {
              const bucket = BUCKETS - 1 - column;
              const count = matrix.counts.get(`${priority}|${bucket}`) ?? 0;
              const start = Math.round((bucket / BUCKETS) * 100);
              const end = Math.round(((bucket + 1) / BUCKETS) * 100);
              return (
                <span
                  key={bucket}
                  title={cellTitle(priorityLabel(priority), count, start, end)}
                  className="aspect-square bg-neutral-3"
                  style={
                    count > 0
                      ? {
                          backgroundColor: `color-mix(in srgb, ${ink} ${Math.round(
                            28 + (count / matrix.peak) * 72,
                          )}%, transparent)`,
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
        className="mt-2 grid text-1 text-neutral-11"
        style={{ gridTemplateColumns: 'auto repeat(4, minmax(0, 1fr))' }}
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
    <div
      className="grid gap-px bg-border"
      style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}
    >
      {Array.from({ length: 2 }, (_, map) => (
        <div key={map} className="bg-background px-4 py-4">
          <div className="h-3 w-20 bg-muted" />
          <div className="mt-4 grid grid-cols-4 gap-1">
            {Array.from({ length: PRIORITIES.length * BUCKETS }, (_, cell) => (
              <span key={cell} className="aspect-square bg-neutral-3" />
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
    return <p className="px-4 py-4 text-2 text-neutral-11">{empty}</p>;
  }

  return (
    <div>
      <div
        className="grid gap-px bg-border"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(14rem, 1fr))' }}
      >
        {groups.map((group) => {
          const label = tSignals.has(`types.${group.type}` as 'types.Need')
            ? tSignals(`types.${group.type}` as 'types.Need')
            : group.type;
          return (
            <Link
              key={group.type}
              href={hrefForType(group.type)}
              className="bg-background px-4 py-4 hover:bg-foreground/5"
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="truncate text-1 uppercase tracking-[0.12em] text-muted-foreground">
                  {label}
                </span>
                <span className="text-3 tabular-nums text-foreground">
                  {group.items.length}
                </span>
              </span>
              <HeatField
                signals={group.items}
                ink={TYPE_INK[group.type] ?? 'var(--accent-11)'}
                priorityLabel={(priority) => tSignals(`priorities.${priority}`)}
                recent={tHeat('signals.recent')}
                older={tHeat('signals.older')}
                cellTitle={(priority, count, start, end) =>
                  tHeat('signals.cellTitle', { priority, count, start, end })
                }
              />
            </Link>
          );
        })}
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 text-1 text-neutral-11">
        <span>{tHeat('signals.lowActivity')}</span>
        <span className="h-2 w-10 bg-neutral-4" />
        <span className="h-2 w-10 bg-foreground" />
        <span>{tHeat('signals.highActivity')}</span>
      </div>
    </div>
  );
}
