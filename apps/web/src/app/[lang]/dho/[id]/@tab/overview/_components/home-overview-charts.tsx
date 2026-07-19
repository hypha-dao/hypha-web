'use client';

import * as React from 'react';
import * as d3 from 'd3';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';

export const SPACE_ACCENT = 'var(--space-accent, var(--accent-9))';

const ACCENT_MIXES = [
  SPACE_ACCENT,
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 72%, white 28%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 58%, var(--color-info-9, var(--info-9)) 42%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 58%, var(--color-success-9, var(--success-9)) 42%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 58%, var(--color-warning-9, var(--warning-9)) 42%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 74%, black 26%)',
];

export function accentColor(index: number): string {
  return ACCENT_MIXES[index % ACCENT_MIXES.length] ?? SPACE_ACCENT;
}

export function prettifyLabel(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function OverviewChartShell({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={`h-full min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[0_0_0_1px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_10%,transparent)] ${
        className ?? ''
      }`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
        {subtitle ? (
          <CardDescription className="text-xs">{subtitle}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function StatRibbon({
  items,
}: {
  items: Array<{ label: string; value: string | number; hint?: string }>;
}) {
  return (
    <Card className="border-border/60 bg-card/95">
      <CardContent className="grid gap-3 py-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
          >
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {item.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {item.value}
            </p>
            {item.hint ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.hint}
              </p>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type ChartSlice = { label: string; value: number; color?: string };

export function DonutChart({
  data,
  centerLabel,
  centerValue,
  emptyLabel,
  size = 220,
}: {
  data: ChartSlice[];
  centerLabel?: string;
  centerValue?: string | number;
  emptyLabel: string;
  size?: number;
}) {
  const gradientId = React.useId().replace(/:/g, '');
  const positive = data.filter((item) => item.value > 0);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  const radius = size / 2;
  const innerRadius = radius * 0.62;
  const outerRadius = radius * 0.92;

  const arcs = React.useMemo(() => {
    if (!positive.length) return [];
    return d3
      .pie<ChartSlice>()
      .value((item) => item.value)
      .sort(null)(positive);
  }, [positive]);

  const arc = d3
    .arc<d3.PieArcDatum<ChartSlice>>()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius)
    .cornerRadius(4);

  if (!positive.length) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="grid items-center gap-4 md:grid-cols-[auto_1fr]">
      <svg
        viewBox={`${-radius} ${-radius} ${size} ${size}`}
        className="mx-auto h-[200px] w-[200px]"
        role="img"
      >
        <defs>
          <linearGradient
            id={`donut-sheen-${gradientId}`}
            x1="0%"
            x2="100%"
            y1="0%"
            y2="100%"
          >
            <stop
              offset="0%"
              stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 88%, white 12%)"
            />
            <stop offset="100%" stopColor={SPACE_ACCENT} />
          </linearGradient>
        </defs>
        {arcs.map((slice, index) => (
          <path
            key={slice.data.label}
            d={arc(slice) ?? ''}
            fill={slice.data.color ?? accentColor(index)}
            stroke="var(--background)"
            strokeWidth={2}
            opacity={0.95}
          />
        ))}
        {centerValue != null ? (
          <>
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y={centerLabel ? -6 : 0}
              className="fill-foreground text-[26px] font-semibold"
            >
              {centerValue}
            </text>
            {centerLabel ? (
              <text
                textAnchor="middle"
                dominantBaseline="middle"
                y={16}
                className="fill-muted-foreground text-[11px]"
              >
                {centerLabel}
              </text>
            ) : null}
          </>
        ) : null}
      </svg>
      <div className="space-y-2 text-sm">
        {positive.map((item, index) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-3"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: item.color ?? accentColor(index) }}
              />
              <span className="truncate">{prettifyLabel(item.label)}</span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
              {item.value}
              <span className="ml-1 text-[10px]">
                ({Math.round((item.value / total) * 100)}%)
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HorizontalBarsChart({
  items,
  emptyLabel,
}: {
  items: ChartSlice[];
  emptyLabel: string;
}) {
  const positive = items.filter((item) => item.value > 0);
  const max = Math.max(...positive.map((item) => item.value), 1);

  if (!positive.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {positive.map((item, index) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate">{prettifyLabel(item.label)}</span>
            <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
              {item.value}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted/80">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max(6, (item.value / max) * 100)}%`,
                background:
                  item.color ??
                  `linear-gradient(90deg, color-mix(in oklab, ${accentColor(
                    index,
                  )} 70%, white 30%), ${accentColor(index)})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function AreaTrendChart({
  points,
  emptyLabel,
}: {
  points: Array<{ label: string; value: number }>;
  emptyLabel: string;
}) {
  const gradientId = React.useId().replace(/:/g, '');
  const width = 640;
  const height = 180;
  const margin = { top: 12, right: 12, bottom: 28, left: 28 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  if (!points.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const x = d3
    .scalePoint<string>()
    .domain(points.map((point) => point.label))
    .range([0, innerWidth])
    .padding(0.4);
  const yMax = Math.max(1, ...points.map((point) => point.value));
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);
  const line = d3
    .line<(typeof points)[number]>()
    .x((point) => x(point.label) ?? 0)
    .y((point) => y(point.value))
    .curve(d3.curveMonotoneX);
  const area = d3
    .area<(typeof points)[number]>()
    .x((point) => x(point.label) ?? 0)
    .y0(innerHeight)
    .y1((point) => y(point.value))
    .curve(d3.curveMonotoneX);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient
          id={`trend-area-${gradientId}`}
          x1="0%"
          x2="0%"
          y1="0%"
          y2="100%"
        >
          <stop
            offset="0%"
            stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 28%, transparent)"
          />
          <stop
            offset="100%"
            stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 4%, transparent)"
          />
        </linearGradient>
      </defs>
      <g transform={`translate(${margin.left},${margin.top})`}>
        {y.ticks(3).map((tick) => (
          <g key={tick} transform={`translate(0,${y(tick)})`}>
            <line
              x1={0}
              x2={innerWidth}
              stroke="var(--border)"
              strokeDasharray="3 3"
              opacity={0.6}
            />
            <text
              x={-6}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[10px]"
            >
              {tick}
            </text>
          </g>
        ))}
        <path d={area(points) ?? ''} fill={`url(#trend-area-${gradientId})`} />
        <path
          d={line(points) ?? ''}
          fill="none"
          stroke={SPACE_ACCENT}
          strokeWidth={2.5}
        />
        {points.map((point) => (
          <circle
            key={point.label}
            cx={x(point.label) ?? 0}
            cy={y(point.value)}
            r={3.5}
            fill={SPACE_ACCENT}
            stroke="var(--background)"
            strokeWidth={1.5}
          />
        ))}
        {points.map((point) => (
          <text
            key={`${point.label}-label`}
            x={x(point.label) ?? 0}
            y={innerHeight + 18}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {point.label.replace(/^(\d{4})-W/, 'W')}
          </text>
        ))}
      </g>
    </svg>
  );
}

export function RadialGauge({
  value,
  max,
  label,
  hint,
}: {
  value: number;
  max: number;
  label: string;
  hint?: string;
}) {
  const gradientId = React.useId().replace(/:/g, '');
  const size = 180;
  const radius = size / 2 - 8;
  const safeMax = Math.max(1, max);
  const ratio = Math.min(1, Math.max(0, value / safeMax));
  const arc = d3
    .arc()
    .innerRadius(radius * 0.72)
    .outerRadius(radius)
    .startAngle(-Math.PI * 0.75)
    .endAngle(Math.PI * 0.75)
    .cornerRadius(8);

  const backgroundArc = arc({
    endAngle: Math.PI * 0.75,
  } as d3.DefaultArcObject)!;
  const valueArc = arc({
    endAngle: -Math.PI * 0.75 + Math.PI * 1.5 * ratio,
  } as d3.DefaultArcObject)!;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <svg
        viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
        className="h-[160px] w-[160px]"
      >
        <defs>
          <linearGradient
            id={`gauge-${gradientId}`}
            x1="0%"
            x2="100%"
            y1="0%"
            y2="0%"
          >
            <stop
              offset="0%"
              stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 70%, white 30%)"
            />
            <stop offset="100%" stopColor={SPACE_ACCENT} />
          </linearGradient>
        </defs>
        <path d={backgroundArc} fill="var(--muted)" opacity={0.55} />
        <path d={valueArc} fill={`url(#gauge-${gradientId})`} />
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          y={-4}
          className="fill-foreground text-[24px] font-semibold"
        >
          {Math.round(ratio * 100)}%
        </text>
        <text
          textAnchor="middle"
          dominantBaseline="middle"
          y={18}
          className="fill-muted-foreground text-[11px]"
        >
          {label}
        </text>
      </svg>
      {hint ? (
        <p className="text-center text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function VerticalBarsChart({
  items,
  emptyLabel,
}: {
  items: ChartSlice[];
  emptyLabel: string;
}) {
  const positive = items.filter((item) => item.value > 0);
  const width = 640;
  const height = 200;
  const margin = { top: 12, right: 12, bottom: 36, left: 28 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  if (!positive.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  const x = d3
    .scaleBand<string>()
    .domain(positive.map((item) => item.label))
    .range([0, innerWidth])
    .padding(0.28);
  const y = d3
    .scaleLinear()
    .domain([0, Math.max(...positive.map((item) => item.value), 1)])
    .nice()
    .range([innerHeight, 0]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <g transform={`translate(${margin.left},${margin.top})`}>
        {positive.map((item, index) => {
          const barX = x(item.label) ?? 0;
          const barHeight = innerHeight - y(item.value);
          return (
            <g key={item.label}>
              <rect
                x={barX}
                y={y(item.value)}
                width={x.bandwidth()}
                height={barHeight}
                rx={6}
                fill={item.color ?? accentColor(index)}
                opacity={0.9}
              />
              <text
                x={barX + x.bandwidth() / 2}
                y={y(item.value) - 6}
                textAnchor="middle"
                className="fill-foreground text-[10px] font-medium"
              >
                {item.value}
              </text>
              <text
                x={barX + x.bandwidth() / 2}
                y={innerHeight + 16}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
