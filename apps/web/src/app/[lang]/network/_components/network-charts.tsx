'use client';

import * as React from 'react';
import * as d3 from 'd3';
import {
  formatCompact,
  formatMonthLabel,
  prefersReducedMotion,
} from './format-network-stats';

function integerTicks(maxValue: number): number[] {
  if (maxValue <= 4) {
    return Array.from({ length: maxValue + 1 }, (_, index) => index);
  }
  const step = Math.max(1, Math.ceil(maxValue / 4));
  const ticks: number[] = [];
  for (let value = 0; value <= maxValue; value += step) {
    ticks.push(value);
  }
  if (ticks.at(-1) !== maxValue) ticks.push(maxValue);
  return ticks;
}

function useDrawPath(
  pathRef: React.RefObject<SVGPathElement | null>,
  signature: string,
  areaRef?: React.RefObject<SVGPathElement | null>,
) {
  React.useEffect(() => {
    const path = pathRef.current;
    const area = areaRef?.current;
    if (!path) return;

    if (prefersReducedMotion()) {
      path.style.strokeDasharray = 'none';
      path.style.strokeDashoffset = '0';
      if (area) area.style.opacity = '1';
      return;
    }

    const length = path.getTotalLength();
    path.style.strokeDasharray = `${length}`;
    path.style.strokeDashoffset = `${length}`;
    path.style.transition = 'none';
    if (area) {
      area.style.opacity = '0';
      area.style.transition = 'none';
    }

    const frame = window.requestAnimationFrame(() => {
      path.style.transition =
        'stroke-dashoffset 1.15s cubic-bezier(0.22, 1, 0.36, 1)';
      path.style.strokeDashoffset = '0';
      if (area) {
        area.style.transition = 'opacity 0.9s ease-out 0.15s';
        area.style.opacity = '1';
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [areaRef, pathRef, signature]);
}

export function NetworkAreaChart({
  months,
  values,
  locale,
  color,
  ariaLabel,
  emptyLabel,
}: {
  months: readonly string[];
  values: readonly number[];
  locale: string;
  color: string;
  ariaLabel: string;
  emptyLabel: string;
}) {
  const pathRef = React.useRef<SVGPathElement>(null);
  const areaRef = React.useRef<SVGPathElement>(null);
  const gradientId = React.useId();
  const points = months.map((month, index) => ({
    month,
    value: values[index] ?? 0,
  }));
  const signature = points
    .map((point) => `${point.month}:${point.value}`)
    .join('|');
  useDrawPath(pathRef, signature, areaRef);

  if (points.length === 0 || points.every((point) => point.value <= 0)) {
    return <p className="craft-meta py-10 text-center">{emptyLabel}</p>;
  }

  const width = 720;
  const height = 220;
  const margin = { top: 16, right: 16, bottom: 32, left: 40 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const yMax = Math.max(...points.map((point) => point.value), 1);
  const x = d3
    .scalePoint<string>()
    .domain(points.map((point) => point.month))
    .range([0, innerWidth])
    .padding(0.2);
  const y = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]).nice();
  const line = d3
    .line<(typeof points)[number]>()
    .x((point) => x(point.month) ?? 0)
    .y((point) => y(point.value))
    .curve(d3.curveMonotoneX);
  const area = d3
    .area<(typeof points)[number]>()
    .x((point) => x(point.month) ?? 0)
    .y0(innerHeight)
    .y1((point) => y(point.value))
    .curve(d3.curveMonotoneX);
  const ticks = integerTicks(Math.ceil(y.domain()[1] ?? yMax));
  const tickEvery = points.length > 8 ? 2 : 1;
  const last = points.at(-1);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${width} ${height}`}
      className="h-48 w-full overflow-visible md:h-56"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <g transform={`translate(${margin.left} ${margin.top})`}>
        {ticks.map((tick) => (
          <g key={tick} transform={`translate(0, ${y(tick)})`}>
            <line
              x1={0}
              x2={innerWidth}
              className="stroke-border/60"
              strokeDasharray="2 5"
            />
            <text
              x={-8}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {formatCompact(tick, locale)}
            </text>
          </g>
        ))}
        <path
          ref={areaRef}
          d={area(points) ?? ''}
          fill={`url(#${gradientId})`}
        />
        <path
          ref={pathRef}
          d={line(points) ?? ''}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {last ? (
          <circle
            cx={x(last.month) ?? 0}
            cy={y(last.value)}
            r="4"
            fill="var(--background)"
            stroke={color}
            strokeWidth="2"
          />
        ) : null}
        {points.map((point, index) =>
          index % tickEvery === 0 || index === points.length - 1 ? (
            <text
              key={point.month}
              x={x(point.month) ?? 0}
              y={innerHeight + 20}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {formatMonthLabel(point.month, locale)}
            </text>
          ) : null,
        )}
      </g>
    </svg>
  );
}

export function NetworkSparkline({
  values,
  color,
  label,
}: {
  values: readonly number[];
  color: string;
  label: string;
}) {
  const pathRef = React.useRef<SVGPathElement>(null);
  const signature = values.join(',');
  useDrawPath(pathRef, signature);

  const width = 88;
  const height = 28;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => ({
    month: String(index),
    value,
  }));
  const x = d3
    .scalePoint<string>()
    .domain(points.map((point) => point.month))
    .range([2, width - 2]);
  const y = d3
    .scaleLinear()
    .domain([0, max])
    .range([height - 3, 3]);
  const line = d3
    .line<(typeof points)[number]>()
    .x((point) => x(point.month) ?? 0)
    .y((point) => y(point.value))
    .curve(d3.curveMonotoneX);

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-20"
    >
      <path
        ref={pathRef}
        d={line(points) ?? ''}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NetworkMixBars({
  items,
}: {
  items: readonly { name: string; count: number }[];
}) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const max = Math.max(...items.map((item) => item.count), 1);
  const reduce = prefersReducedMotion();

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.name} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-1">
            <span className="min-w-0 truncate text-foreground">
              {item.name}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.count}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-accent-9"
              style={{
                width: `${ready || reduce ? (item.count / max) * 100 : 0}%`,
                transition: reduce
                  ? undefined
                  : 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
