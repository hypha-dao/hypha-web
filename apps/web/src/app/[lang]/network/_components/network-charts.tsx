'use client';

import * as React from 'react';
import * as d3 from 'd3';
import {
  formatCompact,
  formatMonthLabel,
  formatMonthYear,
  formatUsd,
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

function nearestIndex(
  points: readonly { month: string }[],
  x: d3.ScalePoint<string>,
  innerX: number,
): number {
  let nearest = 0;
  let best = Number.POSITIVE_INFINITY;
  points.forEach((point, index) => {
    const distance = Math.abs((x(point.month) ?? 0) - innerX);
    if (distance < best) {
      best = distance;
      nearest = index;
    }
  });
  return nearest;
}

export function NetworkAreaChart({
  months,
  values,
  locale,
  color,
  ariaLabel,
  emptyLabel,
  valueLabel,
  valueFormat = 'compact',
}: {
  months: readonly string[];
  values: readonly number[];
  locale: string;
  color: string;
  ariaLabel: string;
  emptyLabel: string;
  valueLabel: string;
  valueFormat?: 'compact' | 'usd';
}) {
  const pathRef = React.useRef<SVGPathElement>(null);
  const areaRef = React.useRef<SVGPathElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const gradientId = React.useId();
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
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
  const hover = hoverIndex == null ? null : points[hoverIndex];
  const hoverX = hover ? x(hover.month) ?? 0 : 0;
  const hoverY = hover ? y(hover.value) : 0;
  const formatValue =
    valueFormat === 'usd'
      ? (value: number) => formatUsd(value, locale)
      : (value: number) => formatCompact(value, locale);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    if (rect.width <= 0) return;
    const svgX = ((event.clientX - rect.left) / rect.width) * width;
    const innerX = svgX - margin.left;
    setHoverIndex(nearestIndex(points, x, innerX));
  };

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="pointer-events-none h-48 w-full md:h-56"
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
          {hover ? (
            <>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={0}
                y2={innerHeight}
                className="stroke-foreground/25"
                strokeWidth="1"
              />
              <circle
                cx={hoverX}
                cy={hoverY}
                r="5"
                fill="var(--background)"
                stroke={color}
                strokeWidth="2"
              />
            </>
          ) : last ? (
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
      <div
        ref={overlayRef}
        className="absolute inset-0 z-10 cursor-crosshair"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      />
      {hover ? (
        <div
          className="pointer-events-none absolute z-20 min-w-28 rounded-lg border border-border/70 bg-background-2 px-2.5 py-1.5 shadow-sm"
          style={{
            left: `${((margin.left + hoverX) / width) * 100}%`,
            top: 8,
            transform:
              hoverX > innerWidth * 0.65
                ? 'translateX(-108%)'
                : 'translateX(8%)',
          }}
        >
          <p className="craft-meta">{formatMonthYear(hover.month, locale)}</p>
          <p className="flex items-baseline justify-between gap-3 text-1">
            <span className="text-muted-foreground">{valueLabel}</span>
            <span className="tabular-nums text-foreground">
              {formatValue(hover.value)}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function NetworkSparkline({
  values,
  months,
  locale,
  color,
  label,
  valueFormat = 'compact',
}: {
  values: readonly number[];
  months?: readonly string[];
  locale?: string;
  color: string;
  label: string;
  valueFormat?: 'compact' | 'usd';
}) {
  const pathRef = React.useRef<SVGPathElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const [hoverIndex, setHoverIndex] = React.useState<number | null>(null);
  const signature = values.join(',');
  useDrawPath(pathRef, signature);

  const width = 88;
  const height = 28;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => ({
    month: months?.[index] ?? String(index),
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
  const hover = hoverIndex == null ? null : points[hoverIndex];
  const formatValue =
    valueFormat === 'usd' && locale
      ? (value: number) => formatUsd(value, locale)
      : locale
      ? (value: number) => formatCompact(value, locale)
      : (value: number) => String(value);

  return (
    <div className="relative">
      <svg
        role="img"
        aria-label={label}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="pointer-events-none h-7 w-20"
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
        {hover ? (
          <circle
            cx={x(hover.month) ?? 0}
            cy={y(hover.value)}
            r="2.5"
            fill="var(--background)"
            stroke={color}
            strokeWidth="1.5"
          />
        ) : null}
      </svg>
      <div
        ref={overlayRef}
        className="absolute inset-0 z-10 cursor-crosshair"
        onPointerMove={(event) => {
          const overlay = overlayRef.current;
          if (!overlay) return;
          const rect = overlay.getBoundingClientRect();
          if (rect.width <= 0) return;
          const innerX = ((event.clientX - rect.left) / rect.width) * width;
          setHoverIndex(nearestIndex(points, x, innerX));
        }}
        onPointerLeave={() => setHoverIndex(null)}
      />
      {hover && locale ? (
        <div className="pointer-events-none absolute bottom-full right-0 z-20 mb-1 whitespace-nowrap rounded-md border border-border/70 bg-background-2 px-2 py-1 text-[11px] shadow-sm">
          <span className="text-muted-foreground">
            {/^\d{4}-\d{2}$/.test(hover.month)
              ? formatMonthYear(hover.month, locale)
              : label}
          </span>{' '}
          <span className="tabular-nums text-foreground">
            {formatValue(hover.value)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
