'use client';

import * as React from 'react';
import { cn } from '@hypha-platform/ui-utils';

/**
 * Lightweight, dependency-free SVG charts tuned for the Hypha dark theme.
 * Each chart renders into a responsive `viewBox` so it scales to its
 * container while keeping crisp vector strokes and gradient fills.
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

type AxisGridProps = {
  max: number;
  labels: string[];
};

const AxisGrid = ({ max, labels }: AxisGridProps) => {
  const rows = 4;
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const labelStep = Math.ceil(labels.length / 7);
  return (
    <g>
      {Array.from({ length: rows + 1 }).map((_, i) => {
        const y = PAD_T + (innerH * i) / rows;
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
      {labels.map((label, i) => {
        if (i % labelStep !== 0 && i !== labels.length - 1) return null;
        const x =
          labels.length === 1
            ? PAD_L + innerW / 2
            : PAD_L + (innerW * i) / (labels.length - 1);
        return (
          <text
            key={`${label}-${i}`}
            x={x}
            y={VIEW_H - 10}
            textAnchor="middle"
            className="fill-neutral-11"
            style={{ fontSize: 10 }}
          >
            {label}
          </text>
        );
      })}
    </g>
  );
};

export type LineAreaChartProps = {
  series: ChartSeries[];
  labels: string[];
  height?: number;
  className?: string;
  fill?: boolean;
};

export const LineAreaChart = ({
  series,
  labels,
  height = 260,
  className,
  fill = true,
}: LineAreaChartProps) => {
  const gradId = React.useId();
  const allValues = series.flatMap((s) => s.values);
  const rawMax = Math.max(1, ...allValues);
  const max = niceMax(rawMax);
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const count = labels.length;

  const xFor = (i: number) =>
    count <= 1 ? PAD_L + innerW / 2 : PAD_L + (innerW * i) / (count - 1);
  const yFor = (v: number) => PAD_T + innerH - (innerH * v) / max;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="mx-auto w-full"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxHeight: height }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
        >
          <AxisGrid max={max} labels={labels} />
          {series.map((s, si) => {
            const linePath = s.values
              .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i)} ${yFor(v)}`)
              .join(' ');
            const areaPath =
              `${linePath} L ${xFor(s.values.length - 1)} ${PAD_T + innerH} ` +
              `L ${xFor(0)} ${PAD_T + innerH} Z`;
            const gid = `${gradId}-${si}`;
            return (
              <g key={s.key}>
                {fill ? (
                  <>
                    <defs>
                      <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor={s.color}
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="100%"
                          stopColor={s.color}
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill={`url(#${gid})`} stroke="none" />
                  </>
                ) : null}
                <path
                  d={linePath}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {s.values.map((v, i) => (
                  <circle
                    key={i}
                    cx={xFor(i)}
                    cy={yFor(v)}
                    r={count > 30 ? 0 : 2.5}
                    fill={s.color}
                  />
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="mt-3">
        <Legend series={series} />
      </div>
    </div>
  );
};

export type BarChartDatum = {
  label: string;
  value: number;
};

export type BarChartProps = {
  data: BarChartDatum[];
  color?: string;
  height?: number;
  className?: string;
  unit?: string;
};

export const BarChart = ({
  data,
  color = ENERGY_PALETTE[1],
  height = 260,
  className,
  unit,
}: BarChartProps) => {
  const gradId = React.useId();
  const rawMax = Math.max(1, ...data.map((d) => d.value));
  const max = niceMax(rawMax);
  const innerW = VIEW_W - PAD_L - PAD_R;
  const innerH = VIEW_H - PAD_T - PAD_B;
  const count = data.length;
  const slot = innerW / Math.max(count, 1);
  const barW = Math.min(slot * 0.6, 34);

  return (
    <div className={cn('w-full', className)}>
      <div
        className="mx-auto w-full"
        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}`, maxHeight: height }}
      >
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          role="img"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.95} />
              <stop offset="100%" stopColor={color} stopOpacity={0.45} />
            </linearGradient>
          </defs>
          <AxisGrid max={max} labels={data.map((d) => d.label)} />
          {data.map((d, i) => {
            const x = PAD_L + slot * i + (slot - barW) / 2;
            const h = (innerH * d.value) / max;
            const y = PAD_T + innerH - h;
            return (
              <rect
                key={`${d.label}-${i}`}
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, 0)}
                rx={3}
                fill={`url(#${gradId})`}
              />
            );
          })}
        </svg>
      </div>
      {unit ? <p className="mt-2 text-1 text-neutral-11">{unit}</p> : null}
    </div>
  );
};
