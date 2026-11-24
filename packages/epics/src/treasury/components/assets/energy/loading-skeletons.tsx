'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CoinsIcon, UsersIcon, ZapIcon } from 'lucide-react';
import { Wave } from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import { ENERGY_PALETTE } from './energy-palette';
import { StatCard } from './shared';

/**
 * Energy loading placeholders. Chart bars keep their own shape. Text lines
 * only light the top edge, the same sweep as the rest of the app.
 */

function Pulse({
  className,
  delayMs = 0,
  style,
  text,
}: {
  className?: string;
  delayMs?: number;
  style?: React.CSSProperties;
  text?: boolean;
}) {
  return (
    <Wave
      text={text}
      className={cn('rounded-md', className)}
      delayMs={delayMs}
      style={style}
    />
  );
}

/** Single text-line placeholder. */
export function EnergyTextSkeleton({
  className,
  delayMs,
}: {
  className?: string;
  delayMs?: number;
}) {
  return (
    <Pulse className={cn('h-4 max-w-full', className)} delayMs={delayMs} />
  );
}

/** Matches {@link StatCard} layout (label + large value). */
export function EnergyStatCardSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div className="relative overflow-hidden craft-card p-4" aria-hidden>
      <span className="absolute inset-x-0 top-0 h-0.5 bg-muted" />
      <Pulse className="h-3 w-24" delayMs={delayMs} />
      <Pulse className="mt-3 h-7 w-32" delayMs={delayMs + 80} />
    </div>
  );
}

export function EnergyStatCardsSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3',
        count === 2 && 'sm:grid-cols-2',
        count === 3 && 'sm:grid-cols-3',
        count >= 4 && 'sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
      role="status"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <EnergyStatCardSkeleton key={i} delayMs={i * 90} />
      ))}
    </div>
  );
}

/** Bar-chart shaped placeholder with staggered bar heights. */
export function EnergyChartSkeleton({
  height = 192,
  bars = 10,
  className,
}: {
  height?: number;
  bars?: number;
  className?: string;
}) {
  const heights = React.useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        // Deterministic wave so SSR/client match and bars feel intentional.
        const t = (i / Math.max(bars - 1, 1)) * Math.PI;
        return 28 + Math.round((Math.sin(t) * 0.5 + 0.5) * 55);
      }),
    [bars],
  );

  return (
    <div
      className={cn(
        'flex w-full items-end justify-between gap-1.5 rounded-lg border border-border/60 bg-muted/20 px-3 pb-3 pt-6',
        className,
      )}
      style={{ height }}
      role="status"
      aria-busy="true"
    >
      {heights.map((pct, i) => (
        <Pulse
          key={i}
          className="min-w-0 flex-1 rounded-t-sm rounded-b-none"
          delayMs={i * 70}
          style={{ height: `${pct}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Member energy diagram uses {@link LineChart}, not bars. The mask must
 * echo the flow plot + legend or the board looks like the old bar chart.
 */
export function EnergyLineChartSkeleton({
  height = 340,
  className,
}: {
  height?: number;
  className?: string;
}) {
  return (
    <div className={cn('w-full', className)} role="status" aria-busy="true">
      <div
        className="relative mx-auto w-full overflow-hidden"
        style={{ aspectRatio: '720 / 260', maxHeight: height }}
      >
        <Wave className="absolute inset-0 rounded-none" />
        <svg
          viewBox="0 0 720 260"
          className="relative h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden
        >
          {[0, 1, 2, 3, 4].map((row) => {
            const y = 16 + (214 * row) / 4;
            return (
              <line
                key={row}
                x1={44}
                y1={y}
                x2={704}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.1}
                strokeWidth={1}
              />
            );
          })}
          {[1, 2].map((part) => (
            <line
              key={part}
              x1={44 + (660 * part) / 3}
              y1={16}
              x2={44 + (660 * part) / 3}
              y2={230}
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={1}
            />
          ))}
          <path
            d="M60 180 C180 40 280 60 380 120 S560 40 680 80"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.22}
            strokeWidth={2.4}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M60 200 C200 120 300 180 380 150 S540 130 680 160"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.16}
            strokeWidth={1.6}
            strokeDasharray="7 4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M60 140 C200 200 280 40 380 100 S560 210 680 130"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1.6}
            strokeDasharray="1.5 3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d="M60 160 C200 100 300 160 380 140 S540 100 680 150"
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1.5}
            strokeDasharray="1 2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {[80, 380, 680].map((x, index) => (
            <circle
              key={x}
              cx={x}
              cy={[180, 120, 80][index]}
              r={3.5}
              fill="currentColor"
              fillOpacity={0.2}
            />
          ))}
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-center gap-2">
            <Pulse className="h-2 w-7 rounded-none" delayMs={index * 60} />
            <Pulse text className="h-2.5 w-16" delayMs={index * 60 + 30} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Full member energy board — title metrics, line plot, community row. */
export function MemberEnergyBoardSkeleton() {
  return (
    <div
      className="flex flex-col gap-4"
      data-member-energy-skeleton=""
      role="status"
      aria-busy="true"
    >
      <div className="flex items-end justify-between gap-4">
        <Pulse text className="h-8 w-56 max-w-[70%]" />
        <Pulse className="h-9 w-40 shrink-0" delayMs={40} />
      </div>
      <div className="border border-border bg-transparent p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Pulse text className="h-3 w-28" />
          <Pulse text className="h-3 w-14" delayMs={40} />
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="min-w-0">
              <Pulse text className="h-3 w-20" delayMs={index * 50} />
              <Pulse text className="mt-2 h-9 w-28" delayMs={index * 50 + 30} />
              <Pulse
                text
                className="mt-2 h-3 w-36 max-w-full"
                delayMs={index * 50 + 60}
              />
            </div>
          ))}
        </div>
        <div className="mt-6">
          <EnergyLineChartSkeleton height={340} />
        </div>
        <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="min-w-0">
              <Pulse text className="h-3 w-24" delayMs={200 + index * 40} />
              <Pulse
                text
                className="mt-2 h-6 w-20"
                delayMs={220 + index * 40}
              />
              <Pulse
                text
                className="mt-2 h-3 w-28"
                delayMs={240 + index * 40}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="border border-border bg-transparent p-4 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Pulse text className="h-4 w-48 max-w-full" delayMs={280} />
            <Pulse text className="mt-2 h-3 w-40 max-w-full" delayMs={300} />
          </div>
          <Pulse text className="h-7 w-12 shrink-0" delayMs={290} />
        </div>
        <Pulse className="mt-4 h-1.5 w-full rounded-none" delayMs={320} />
      </div>
    </div>
  );
}

/** Person/list row placeholder (avatar + two text lines). */
export function EnergyPersonRowSkeleton({ delayMs = 0 }: { delayMs?: number }) {
  return (
    <div className="flex items-center gap-3 craft-card p-3" aria-hidden>
      <Pulse className="h-10 w-10 shrink-0 rounded-full" delayMs={delayMs} />
      <div className="min-w-0 flex-1 space-y-2">
        <Pulse className="h-4 w-36 max-w-full" delayMs={delayMs + 60} />
        <Pulse className="h-3 w-24 max-w-full" delayMs={delayMs + 120} />
      </div>
      <Pulse
        className="h-6 w-14 shrink-0 rounded-full"
        delayMs={delayMs + 90}
      />
    </div>
  );
}

/** Initial Energy section load — labeled stats, no chart JS. */
export function EnergySectionSkeleton() {
  const tOverview = useTranslations('Energy.overview');
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label={tOverview('statConsumers')}
          value={<Pulse className="h-7 w-16" />}
          accent={ENERGY_PALETTE[2]}
          icon={<UsersIcon size={16} />}
        />
        <StatCard
          label={tOverview('statSources')}
          value={<Pulse className="h-7 w-16" delayMs={80} />}
          accent={ENERGY_PALETTE[0]}
          icon={<ZapIcon size={16} />}
        />
        <StatCard
          label={tOverview('statTotalSettled')}
          value={<Pulse className="h-7 w-24" delayMs={160} />}
          accent={ENERGY_PALETTE[1]}
          icon={<CoinsIcon size={16} />}
        />
      </div>
      <div className="flex flex-col gap-4">
        <Pulse className="h-10 w-full max-w-xl rounded-full" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <EnergyPersonRowSkeleton key={i} delayMs={i * 100} />
          ))}
        </div>
      </div>
    </div>
  );
}
