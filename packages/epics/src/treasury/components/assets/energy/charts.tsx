'use client';

import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Lightweight, dependency-free SVG bar charts tuned for the Hypha dark theme.
 * Rendered into a responsive `viewBox` (wrapped in an aspect-ratio box) so they
 * scale to their container without distortion. Hovering a category band reveals
 * an HTML tooltip positioned in viewBox-percentage space.
 */

export const ENERGY_PALETTE = [
  '#f5b544', // solar amber
  '#3ecf8e', // green
  '#5b9dff', // blue
  '#b07cff', // violet
  '#ff7a9c', // pink
  '#4dd0e1', // cyan
] as const;

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  values: number[];
};

const VIEW_W = 720;
const VIEW_H = 260;
const PAD_L = 44;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 30;
const INNER_W = VIEW_W - PAD_L - PAD_R;
const INNER_H = VIEW_H - PAD_T - PAD_B;

const niceMax = (max: number) => {
  if (max <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
};

const formatTick = (v: number) => {
  if (Math.abs(v) >= 1000)
    return `${(v / 1000).toLocaleString(undefined, {
      maximumFractionDigits: 1,
    })}k`;
  return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const Legend = ({ series }: { series: ChartSeries[] }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
    {series.map((s) => (
      <div key={s.key} className="flex items-center gap-1.5">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: s.color }}
        />
        <span className="text-1 text-neutral-11">{s.label}</span>
      </div>
    ))}
  </div>
);

const GridLines = ({ max }: { max: number }) => {
  const rows = 4;
  return (
    <g>
      {Array.from({ length: rows + 1 }).map((_, i) => {
        const y = PAD_T + (INNER_H * i) / rows;
        const value = max - (max * i) / rows;
        return (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={y}
              x2={VIEW_W - PAD_R}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.08}
              strokeWidth={1}
            />
            <text
              x={PAD_L - 8}
              y={y + 3}
              textAnchor="end"
              className="fill-neutral-11"
              style={{ fontSize: 10 }}
            >
              {formatTick(value)}
            </text>
          </g>
        );
      })}
    </g>
  );
};

export type BarChartProps = {
  series: ChartSeries[];
  labels: string[];
  mode?: 'grouped' | 'stacked';
  height?: number;
  className?: string;
  /** Suffix appended to values in the hover tooltip (e.g. " kWh"). */
  valueSuffix?: string;
  showLegend?: boolean;
};

export const BarChart = ({
  series,
  labels,
  mode = 'grouped',
  height = 280,
  className,
  valueSuffix = '',
  showLegend = true,
}: BarChartProps) => {
  const gradId = React.useId();
  const [hovered, setHovered] = React.useState<number | null>(null);

  const count = labels.length;
  const slot = INNER_W / Math.max(count, 1);

  const rawMax =
    mode === 'stacked'
      ? Math.max(
          1,
          ...labels.map((_, i) =>
            series.reduce((acc, s) => acc + (s.values[i] ?? 0), 0),
          ),
        )
      : Math.max(1, ...series.flatMap((s) => s.values));
  const max = niceMax(rawMax);

  const yFor = (v: number) => PAD_T + INNER_H - (INNER_H * v) / max;
  const labelStep = Math.ceil(count / 8);

  // Bar geometry within each category slot.
  const groupW = Math.min(slot * 0.72, mode === 'stacked' ? 40 : 56);
  const groupStart = (i: number) => PAD_L + slot * i + (slot - groupW) / 2;
  const barW =
    mode === 'stacked' ? groupW : groupW / Math.max(series.length, 1);

  const fmt = (v: number) =>
    `${v.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}${valueSuffix}`;

  // Tooltip anchor for the hovered band.
  const tooltip = React.useMemo(() => {
    if (hovered === null) return null;
    const topValue =
      mode === 'stacked'
        ? series.reduce((acc, s) => acc + (s.values[hovered] ?? 0), 0)
        : Math.max(...series.map((s) => s.values[hovered] ?? 0));
    const xCenter = PAD_L + slot * (hovered + 0.5);
    const yTop = yFor(topValue);
    return {
      leftPct: (xCenter / VIEW_W) * 100,
      topPct: (yTop / VIEW_H) * 100,
      label: labels[hovered],
      rows: series.map((s) => ({
        label: s.label,
        color: s.color,
        value: s.values[hovered] ?? 0,
      })),
      total: topValue,
    };
  }, [hovered, labels, series, slot, mode]);

  return (
    <div className={cn('w-full', className)}>
      <div
        className="relative mx-auto w-full"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxHeight: height }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
        >
          <defs>
            {series.map((s, si) => (
              <linearGradient
                key={si}
                id={`${gradId}-${si}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0%" stopColor={s.color} stopOpacity={0.95} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0.5} />
              </linearGradient>
            ))}
          </defs>

          <GridLines max={max} />

          {/* Bars */}
          {labels.map((_, i) => {
            if (mode === 'stacked') {
              let cursor = 0;
              return (
                <g key={i} style={{ pointerEvents: 'none' }}>
                  {series.map((s, si) => {
                    const v = s.values[i] ?? 0;
                    const h = (INNER_H * v) / max;
                    cursor += v;
                    const y = yFor(cursor);
                    return (
                      <rect
                        key={si}
                        x={groupStart(i)}
                        y={y}
                        width={barW}
                        height={Math.max(h, 0)}
                        fill={`url(#${gradId}-${si})`}
                        opacity={hovered === null || hovered === i ? 1 : 0.4}
                        rx={2}
                      />
                    );
                  })}
                </g>
              );
            }
            return (
              <g key={i} style={{ pointerEvents: 'none' }}>
                {series.map((s, si) => {
                  const v = s.values[i] ?? 0;
                  const h = (INNER_H * v) / max;
                  const y = yFor(v);
                  return (
                    <rect
                      key={si}
                      x={groupStart(i) + barW * si}
                      y={y}
                      width={Math.max(barW - 1.5, 1)}
                      height={Math.max(h, 0)}
                      fill={`url(#${gradId}-${si})`}
                      opacity={hovered === null || hovered === i ? 1 : 0.4}
                      rx={2}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X labels */}
          {labels.map((label, i) => {
            if (i % labelStep !== 0 && i !== count - 1) return null;
            return (
              <text
                key={`${label}-${i}`}
                x={PAD_L + slot * (i + 0.5)}
                y={VIEW_H - 10}
                textAnchor="middle"
                className="fill-neutral-11"
                style={{ fontSize: 10 }}
              >
                {label}
              </text>
            );
          })}

          {/* Hover bands (capture pointer) */}
          {labels.map((_, i) => (
            <rect
              key={`band-${i}`}
              x={PAD_L + slot * i}
              y={PAD_T}
              width={slot}
              height={INNER_H}
              fill={hovered === i ? 'currentColor' : 'transparent'}
              fillOpacity={hovered === i ? 0.05 : 0}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((cur) => (cur === i ? null : cur))}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </svg>

        {tooltip ? (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+8px)] whitespace-nowrap rounded-lg border border-border bg-background-2 px-2.5 py-1.5 shadow-lg"
            style={{ left: `${tooltip.leftPct}%`, top: `${tooltip.topPct}%` }}
          >
            <p className="mb-1 text-1 font-medium text-foreground">
              {tooltip.label}
            </p>
            {tooltip.rows.map((row) => (
              <div key={row.label} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-1 text-neutral-11">{row.label}</span>
                <span className="text-1 font-medium text-foreground">
                  {fmt(row.value)}
                </span>
              </div>
            ))}
            {mode === 'stacked' && tooltip.rows.length > 1 ? (
              <div className="mt-1 border-t border-border pt-1 text-1 font-medium text-foreground">
                Total {fmt(tooltip.total)}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {showLegend && series.length > 1 ? (
        <div className="mt-3">
          <Legend series={series} />
        </div>
      ) : null}
    </div>
  );
};
