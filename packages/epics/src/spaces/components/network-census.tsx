'use client';

import {
  cumulativePlotDomain,
  type CumulativePoint,
  type NetworkGrowth,
} from '@hypha-platform/core/client';
import { Locale } from '@hypha-platform/i18n';
import { Skeleton } from '@hypha-platform/ui';
import { useTranslations } from 'next-intl';

const CHART_WIDTH = 640;
const CHART_HEIGHT = 208;
const PLOT_LEFT = 44;
const PLOT_RIGHT = 12;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 28;

type CensusFigures = {
  total: number;
  publicCount: number;
  privateCount: number;
  /** Null when the source has no timestamp, so a delta would be invented. */
  thisMonth: number | null;
};

function formatCount(value: number, lang: string): string {
  return new Intl.NumberFormat(lang).format(value);
}

function formatMonthLabel(monthKey: string, lang: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat(lang, {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatAxisTick(value: number, lang: string): string {
  const rounded = Math.round(value);
  return new Intl.NumberFormat(lang, {
    notation: Math.abs(rounded) >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: Math.abs(rounded) >= 10000 ? 1 : 0,
  }).format(rounded);
}

function plotX(index: number, count: number): number {
  const width = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  if (count <= 1) return PLOT_LEFT + width / 2;
  return PLOT_LEFT + ((index + 0.5) * width) / count;
}

function plotY(value: number, min: number, max: number): number {
  const height = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const span = max - min || 1;
  return PLOT_TOP + height - ((value - min) / span) * height;
}

function StatCard({
  value,
  label,
  split,
  thisMonth,
  thisMonthLabel,
  isLoading,
  reserveSplit = false,
  lang,
}: {
  value: number | null;
  label: string;
  split: string | null;
  thisMonth: number | null;
  thisMonthLabel: (count: number) => string;
  isLoading: boolean;
  /** Skeleton a second line while the public/private split is still resolving. */
  reserveSplit?: boolean;
  lang: string;
}) {
  return (
    <article className="flex h-full min-w-0 flex-col border border-border bg-background-2 px-4 py-3.5 dark:bg-background-5">
      <div className="[font-family:var(--font-family-heading)] text-7 font-medium tabular-nums tracking-[-0.03em] text-foreground">
        {isLoading ? (
          <Skeleton loading width={72} height={28} />
        ) : value == null ? (
          '—'
        ) : (
          formatCount(value, lang)
        )}
      </div>
      <div className="mt-1 text-1 text-muted-foreground">{label}</div>
      {isLoading && reserveSplit ? (
        <Skeleton loading width={96} height={12} className="mt-1" />
      ) : split ? (
        <div className="mt-1 text-1 text-muted-foreground">{split}</div>
      ) : null}
      {!isLoading && thisMonth != null ? (
        <div className="mt-auto pt-3 text-1 font-medium tabular-nums text-[color:var(--hypha-chart)]">
          {thisMonthLabel(thisMonth)}
        </div>
      ) : (
        <div className="mt-auto" />
      )}
    </article>
  );
}

function GrowthChart({
  title,
  subtitle,
  ariaLabel,
  points,
  lang,
  variant,
}: {
  title: string;
  subtitle: string;
  ariaLabel: string;
  points: CumulativePoint[];
  lang: string;
  variant: 'bars' | 'line';
}) {
  const values = points.map((point) => point.cumulative);
  const domain = cumulativePlotDomain(values);
  const baseline = plotY(domain.min, domain.min, domain.max);
  const ticks = [0, 1, 2, 3].map(
    (index) => domain.min + ((domain.max - domain.min) * index) / 3,
  );
  const slot =
    points.length > 0
      ? (CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT) / points.length
      : 0;
  const barWidth = Math.min(18, slot * 0.46);
  const linePath = points
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command}${plotX(index, points.length)},${plotY(
        point.cumulative,
        domain.min,
        domain.max,
      )}`;
    })
    .join(' ');
  const seenTickLabels = new Set<string>();

  return (
    <section className="flex h-full min-w-0 flex-col border border-border bg-background-2 px-4 py-3.5 dark:bg-background-5">
      <h3 className="[font-family:var(--font-family-heading)] text-3 font-medium tracking-[-0.03em] text-foreground">
        {title}
      </h3>
      <p className="mt-0.5 text-1 text-muted-foreground">{subtitle}</p>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="mt-2 h-44 w-full"
        role="img"
        aria-label={ariaLabel}
      >
        {ticks.map((tick) => {
          const label = formatAxisTick(tick, lang);
          const y = plotY(tick, domain.min, domain.max);
          const showLabel = !seenTickLabels.has(label);
          seenTickLabels.add(label);
          return (
            <g key={`${label}-${y}`}>
              <line
                x1={PLOT_LEFT}
                x2={CHART_WIDTH - PLOT_RIGHT}
                y1={y}
                y2={y}
                stroke="var(--hypha-border)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              {showLabel ? (
                <text
                  x={PLOT_LEFT - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="var(--hypha-text-faint)"
                  fontSize={11}
                  fontFamily="var(--font-sans)"
                >
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
        {variant === 'bars'
          ? points.map((point, index) => {
              const x = plotX(index, points.length);
              const y = plotY(point.cumulative, domain.min, domain.max);
              const height = Math.max(0, baseline - y);
              return (
                <rect
                  key={point.month}
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={height}
                  fill="var(--hypha-chart)"
                >
                  <title>
                    {`${formatMonthLabel(point.month, lang)} ${formatCount(
                      point.cumulative,
                      lang,
                    )}`}
                  </title>
                </rect>
              );
            })
          : null}
        {variant === 'line' && points.length > 0 ? (
          <path
            d={linePath}
            fill="none"
            stroke="var(--hypha-chart)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {variant === 'line'
          ? points.map((point, index) => (
              <circle
                key={point.month}
                cx={plotX(index, points.length)}
                cy={plotY(point.cumulative, domain.min, domain.max)}
                r={4.5}
                fill="var(--hypha-chart)"
              >
                <title>
                  {`${formatMonthLabel(point.month, lang)} ${formatCount(
                    point.cumulative,
                    lang,
                  )}`}
                </title>
              </circle>
            ))
          : null}
        {points.map((point, index) => {
          const isLast = index === points.length - 1;
          const showLabel =
            isLast || (index % 2 === 0 && index < points.length - 2);
          if (!showLabel) return null;
          return (
            <text
              key={`${point.month}-label`}
              x={plotX(index, points.length)}
              y={CHART_HEIGHT - 8}
              textAnchor="middle"
              fill="var(--hypha-text-faint)"
              fontSize={11}
              fontFamily="var(--font-sans)"
            >
              {formatMonthLabel(point.month, lang)}
            </text>
          );
        })}
      </svg>
    </section>
  );
}

export function NetworkCensus({
  lang,
  isLoading,
  spaces,
  members,
  agreements,
  transactions,
  tokens,
  growth,
}: {
  lang: Locale;
  isLoading: boolean;
  spaces: CensusFigures;
  members: CensusFigures;
  agreements: CensusFigures;
  transactions: CensusFigures | null;
  tokens: CensusFigures | null;
  growth: NetworkGrowth | null;
}) {
  const t = useTranslations('Network');
  const tCommon = useTranslations('Common');

  const split = (directory: number, privateCount: number) =>
    privateCount > 0
      ? t('directoryPrivateSplit', {
          directory,
          private: privateCount,
        })
      : null;

  const thisMonthLabel = (count: number) => t('addedThisMonth', { count });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard
          lang={lang}
          value={isLoading ? null : spaces.total}
          label={tCommon('Spaces')}
          split={
            isLoading ? null : split(spaces.publicCount, spaces.privateCount)
          }
          thisMonth={isLoading ? null : spaces.thisMonth}
          thisMonthLabel={thisMonthLabel}
          isLoading={isLoading}
          reserveSplit
        />
        <StatCard
          lang={lang}
          value={isLoading ? null : members.total}
          label={tCommon('Members')}
          split={
            isLoading ? null : split(members.publicCount, members.privateCount)
          }
          thisMonth={isLoading ? null : members.thisMonth}
          thisMonthLabel={thisMonthLabel}
          isLoading={isLoading}
          reserveSplit
        />
        <StatCard
          lang={lang}
          value={isLoading ? null : agreements.total}
          label={tCommon('Agreements')}
          split={
            isLoading
              ? null
              : split(agreements.publicCount, agreements.privateCount)
          }
          thisMonth={isLoading ? null : agreements.thisMonth}
          thisMonthLabel={thisMonthLabel}
          isLoading={isLoading}
          reserveSplit
        />
        <StatCard
          lang={lang}
          value={transactions?.total ?? null}
          label={t('transactions')}
          split={null}
          thisMonth={transactions?.thisMonth ?? null}
          thisMonthLabel={thisMonthLabel}
          isLoading={false}
        />
        <StatCard
          lang={lang}
          value={tokens?.total ?? null}
          label={t('tokens')}
          split={null}
          thisMonth={tokens?.thisMonth ?? null}
          thisMonthLabel={thisMonthLabel}
          isLoading={false}
        />
      </div>
      {growth ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <GrowthChart
            title={tCommon('Members')}
            subtitle={t('cumulative')}
            ariaLabel={t('memberGrowthChart')}
            points={growth.members}
            lang={lang}
            variant="bars"
          />
          <GrowthChart
            title={tCommon('Agreements')}
            subtitle={t('cumulative')}
            ariaLabel={t('agreementGrowthChart')}
            points={growth.agreements}
            lang={lang}
            variant="line"
          />
        </div>
      ) : null}
    </div>
  );
}
