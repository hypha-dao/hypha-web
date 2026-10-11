'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { COHERENCE_TYPES } from '@hypha-platform/core/client';

import './signal-heat-map.css';

const COLS = 8;
const ROWS = 6;
const CELLS = COLS * ROWS;

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

const PRIORITY_HEAT: Record<string, number> = {
  critical: 1,
  high: 0.78,
  medium: 0.52,
  low: 0.3,
};

/** Cells nearest the center, so heat gathers in the middle of the field. */
const CENTER_ORDER = (() => {
  const cx = (COLS - 1) / 2;
  const cy = (ROWS - 1) / 2;
  const cells = Array.from({ length: CELLS }, (_, index) => {
    const x = index % COLS;
    const y = Math.floor(index / COLS);
    return { index, distance: Math.hypot(x - cx, y - cy) };
  });
  cells.sort(
    (left, right) => left.distance - right.distance || left.index - right.index,
  );
  return cells;
})();

const DISTANCE_BY_INDEX = CENTER_ORDER.reduce<number[]>((distances, cell) => {
  distances[cell.index] = cell.distance;
  return distances;
}, []);

type HeatSignal = {
  type: string;
  priority: string;
};

function heatOf(priority: string) {
  return PRIORITY_HEAT[priority] ?? 0.52;
}

function buildField(signals: HeatSignal[]) {
  const heats = signals.map((signal) => heatOf(signal.priority));
  heats.sort((left, right) => right - left);
  const field = Array.from({ length: CELLS }, () => 0);
  if (heats.length === 0) return field;
  if (heats.length <= CELLS) {
    heats.forEach((heat, order) => {
      const cell = CENTER_ORDER[order];
      if (!cell) return;
      field[cell.index] = heat;
    });
    return field;
  }
  for (let order = 0; order < CELLS; order += 1) {
    const start = Math.floor((order * heats.length) / CELLS);
    const end = Math.max(
      start + 1,
      Math.floor(((order + 1) * heats.length) / CELLS),
    );
    const slice = heats.slice(start, end);
    const mean =
      slice.reduce((sum, value) => sum + value, 0) / Math.max(slice.length, 1);
    const cell = CENTER_ORDER[order];
    if (!cell) continue;
    field[cell.index] = mean;
  }
  return field;
}

function HeatField({ signals, ink }: { signals: HeatSignal[]; ink: string }) {
  const field = useMemo(() => buildField(signals), [signals]);
  return (
    <div
      className="mt-4 grid gap-px bg-border"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      aria-hidden
    >
      {field.map((heat, index) => {
        const hot = heat > 0;
        const distance = DISTANCE_BY_INDEX[index] ?? 0;
        return (
          <span
            key={index}
            className={
              hot
                ? 'signal-heat-cell aspect-square'
                : 'aspect-square bg-neutral-3'
            }
            style={
              hot
                ? {
                    backgroundColor: `color-mix(in srgb, ${ink} ${Math.round(
                      24 + heat * 76,
                    )}%, transparent)`,
                    animationDuration: `${Math.round(3200 - heat * 1400)}ms`,
                    animationDelay: `${Math.round(distance * 180)}ms`,
                  }
                : undefined
            }
          />
        );
      })}
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
          <div
            className="mt-4 grid gap-px bg-border"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: CELLS }, (_, cell) => (
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
            />
          </Link>
        );
      })}
    </div>
  );
}
