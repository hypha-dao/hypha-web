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
      <CardContent
        className={`grid gap-3 py-4 sm:grid-cols-2 ${
          items.length >= 6 ? 'xl:grid-cols-6' : 'xl:grid-cols-4'
        }`}
      >
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
  includeZeroValues = false,
}: {
  items: ChartSlice[];
  emptyLabel: string;
  includeZeroValues?: boolean;
}) {
  const positive = items.filter((item) => item.value > 0);
  const visibleItems = includeZeroValues ? items : positive;
  const max = Math.max(...positive.map((item) => item.value), 1);

  if (!visibleItems.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visibleItems.map((item, index) => (
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
                width:
                  item.value > 0
                    ? `${Math.max(6, (item.value / max) * 100)}%`
                    : '0%',
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

export type ShareTimelinePoint = {
  date: Date;
  share_pct: number;
};

export function ShareStepTimelineChart({
  points,
  activePoint,
  onActivePointChange,
  percentageFormatter = (value) => `${value.toFixed(1)}%`,
}: {
  points: ShareTimelinePoint[];
  activePoint: ShareTimelinePoint | null;
  onActivePointChange: (point: ShareTimelinePoint | null) => void;
  percentageFormatter?: (value: number) => string;
}) {
  const gradientId = React.useId().replace(/:/g, '');
  const width = 960;
  const height = 320;
  const margin = { top: 20, right: 24, bottom: 52, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const chartModel = React.useMemo(() => {
    if (!points.length) return null;

    const xDomain = d3.extent(points, (point) => point.date);
    const x = d3
      .scaleTime()
      .domain(
        xDomain[0] && xDomain[1]
          ? [xDomain[0], xDomain[1]]
          : [new Date(Date.now() - 86_400_000), new Date()],
      )
      .range([0, innerWidth]);
    const maxY = Math.max(1, ...points.map((point) => point.share_pct));
    const minY = Math.min(...points.map((point) => point.share_pct));
    const spread = Math.max(1, maxY - minY);
    const yPadding = Math.max(0.8, spread * 0.14);
    const baseline = points[0]?.share_pct ?? 0;
    const minYWithPadding = Math.max(0, Math.min(minY, baseline) - yPadding);
    const y = d3
      .scaleLinear()
      .domain([minYWithPadding, maxY + yPadding])
      .nice(5)
      .range([innerHeight, 0]);
    const stepLine = d3
      .line<ShareTimelinePoint>()
      .x((point) => x(point.date))
      .y((point) => y(point.share_pct))
      .curve(d3.curveStepAfter);
    const stepArea = d3
      .area<ShareTimelinePoint>()
      .x((point) => x(point.date))
      .y0(y(baseline))
      .y1((point) => y(point.share_pct))
      .curve(d3.curveStepAfter);
    const xTicks =
      points.length <= 6
        ? points.map((point) => point.date)
        : (() => {
            const step = Math.max(1, Math.floor((points.length - 1) / 5));
            const ticks = points
              .filter((_, index) => index % step === 0)
              .map((point) => point.date);
            const lastDate = points.at(-1)?.date;
            if (
              lastDate &&
              !ticks.some((value) => value.getTime() === lastDate.getTime())
            ) {
              ticks.push(lastDate);
            }
            return ticks;
          })();

    return {
      x,
      y,
      baseline,
      minYWithPadding,
      stepLine,
      stepArea,
      yTicks: y.ticks(5),
      xTicks,
    };
  }, [innerHeight, innerWidth, points]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (!chartModel || points.length === 0) return;

      const point = event.currentTarget.ownerSVGElement?.createSVGPoint();
      const ctm = event.currentTarget.getScreenCTM();
      if (!point || !ctm) return;

      point.x = event.clientX;
      point.y = event.clientY;
      const svgPoint = point.matrixTransform(ctm.inverse());
      const date = chartModel.x.invert(svgPoint.x);
      const bisect = d3.bisector<ShareTimelinePoint, Date>(
        (entry) => entry.date,
      ).left;
      const index = bisect(points, date, 1);
      const previous = points[index - 1];
      const next = points[index];

      if (!previous) {
        onActivePointChange(next ?? null);
        return;
      }
      if (!next) {
        onActivePointChange(previous);
        return;
      }

      onActivePointChange(
        date.getTime() - previous.date.getTime() >
          next.date.getTime() - date.getTime()
          ? next
          : previous,
      );
    },
    [chartModel, onActivePointChange, points],
  );

  if (!chartModel) return null;

  const active = activePoint ?? points.at(-1) ?? null;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
      <defs>
        <linearGradient
          id={`share-step-line-${gradientId}`}
          x1="0%"
          x2="100%"
          y1="0%"
          y2="0%"
        >
          <stop
            offset="0%"
            stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 68%, white 32%)"
          />
          <stop offset="100%" stopColor={SPACE_ACCENT} />
        </linearGradient>
        <linearGradient
          id={`share-step-gain-${gradientId}`}
          x1="0%"
          x2="0%"
          y1="0%"
          y2="100%"
        >
          <stop
            offset="0%"
            stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 34%, transparent)"
          />
          <stop
            offset="100%"
            stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 6%, transparent)"
          />
        </linearGradient>
        <linearGradient
          id={`share-step-loss-${gradientId}`}
          x1="0%"
          x2="0%"
          y1="100%"
          y2="0%"
        >
          <stop
            offset="0%"
            stopColor="color-mix(in oklab, var(--color-warning-9, var(--warning-9)) 24%, transparent)"
          />
          <stop
            offset="100%"
            stopColor="color-mix(in oklab, var(--color-warning-9, var(--warning-9)) 6%, transparent)"
          />
        </linearGradient>
        <filter
          id={`share-step-glow-${gradientId}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform={`translate(${margin.left},${margin.top})`}>
        {chartModel.yTicks.map((tick) => (
          <g key={tick} transform={`translate(0,${chartModel.y(tick)})`}>
            <line
              x1={0}
              x2={innerWidth}
              stroke="var(--border)"
              strokeDasharray="4 5"
              opacity={0.55}
            />
            <text
              x={-12}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {percentageFormatter(tick)}
            </text>
          </g>
        ))}

        <line
          x1={0}
          x2={innerWidth}
          y1={chartModel.y(chartModel.baseline)}
          y2={chartModel.y(chartModel.baseline)}
          stroke="var(--border)"
          strokeDasharray="2 4"
          opacity={0.9}
        />

        {points.map((point, index) => {
          const previous = points[index - 1];
          const delta = previous
            ? point.share_pct - previous.share_pct
            : point.share_pct - chartModel.baseline;
          const pillarHeight = Math.abs(
            chartModel.y(Math.min(point.share_pct, chartModel.baseline)) -
              chartModel.y(Math.max(point.share_pct, chartModel.baseline)),
          );
          return (
            <g key={point.date.toISOString()}>
              <rect
                x={chartModel.x(point.date) - 1.5}
                y={chartModel.y(Math.max(point.share_pct, chartModel.baseline))}
                width={3}
                height={Math.max(2, pillarHeight)}
                rx={1.5}
                fill={
                  delta >= 0
                    ? `url(#share-step-gain-${gradientId})`
                    : `url(#share-step-loss-${gradientId})`
                }
                opacity={0.85}
              />
            </g>
          );
        })}

        <path
          d={chartModel.stepArea(points) ?? ''}
          fill={`url(#share-step-gain-${gradientId})`}
          opacity={0.95}
        />
        <path
          d={chartModel.stepLine(points) ?? ''}
          fill="none"
          stroke={`url(#share-step-line-${gradientId})`}
          strokeWidth={3.5}
          strokeLinecap="round"
        />

        {points.map((point) => {
          const isActive = active?.date.getTime() === point.date.getTime();
          return (
            <circle
              key={`${point.date.toISOString()}-dot`}
              cx={chartModel.x(point.date)}
              cy={chartModel.y(point.share_pct)}
              r={isActive ? 6 : 3.5}
              fill={SPACE_ACCENT}
              stroke="var(--background)"
              strokeWidth={isActive ? 2 : 1.5}
              opacity={isActive ? 1 : 0.7}
              filter={
                isActive ? `url(#share-step-glow-${gradientId})` : undefined
              }
            />
          );
        })}

        {active ? (
          <g pointerEvents="none">
            <line
              x1={chartModel.x(active.date)}
              x2={chartModel.x(active.date)}
              y1={0}
              y2={innerHeight}
              stroke={SPACE_ACCENT}
              strokeDasharray="4 4"
              opacity={0.35}
            />
            <rect
              x={Math.min(
                innerWidth - 148,
                Math.max(0, chartModel.x(active.date) - 74),
              )}
              y={Math.max(6, chartModel.y(active.share_pct) - 48)}
              width={148}
              height={40}
              rx={10}
              fill="var(--card)"
              stroke="var(--border)"
            />
            <text
              x={Math.min(
                innerWidth - 140,
                Math.max(8, chartModel.x(active.date) - 66),
              )}
              y={Math.max(22, chartModel.y(active.share_pct) - 32)}
              className="fill-muted-foreground text-[10px]"
            >
              {d3.timeFormat('%b %d, %Y')(active.date)}
            </text>
            <text
              x={Math.min(
                innerWidth - 140,
                Math.max(8, chartModel.x(active.date) - 66),
              )}
              y={Math.max(38, chartModel.y(active.share_pct) - 16)}
              className="fill-foreground text-[13px] font-semibold"
            >
              {percentageFormatter(active.share_pct)}
            </text>
          </g>
        ) : null}

        {chartModel.xTicks.map((tick) => (
          <g
            key={tick.toISOString()}
            transform={`translate(${chartModel.x(tick)},0)`}
          >
            <line
              y1={innerHeight}
              y2={innerHeight + 8}
              stroke="var(--border)"
            />
            <text
              y={innerHeight + 24}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {d3.timeFormat('%b %d')(tick)}
            </text>
          </g>
        ))}

        <rect
          x={0}
          y={0}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => onActivePointChange(null)}
        />
      </g>
    </svg>
  );
}
