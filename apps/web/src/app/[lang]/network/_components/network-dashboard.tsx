import { getLocale, getTranslations } from 'next-intl/server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import type {
  NamedCount,
  NetworkDashboardStats,
} from '@hypha-platform/core/client';

const TOKEN_TYPE_KEYS = [
  'utility',
  'credits',
  'ownership',
  'voice',
  'impact',
  'community_currency',
] as const;

type TokenTypeKey = (typeof TOKEN_TYPE_KEYS)[number];

function isTokenTypeKey(value: string): value is TokenTypeKey {
  return (TOKEN_TYPE_KEYS as readonly string[]).includes(value);
}

function formatCompact(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatExact(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    value,
  );
}

function formatMonthLabel(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Intl.DateTimeFormat(locale, { month: 'short' }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

function percentOf(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

function seriesPath(
  values: readonly number[],
  width: number,
  height: number,
  close: boolean,
): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const lastIndex = Math.max(values.length - 1, 1);
  const points = values.map((value, index) => {
    const x = (index / lastIndex) * width;
    const y = height - (value / max) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point}`)
    .join(' ');
  if (!close) return line;
  return `${line} L${width.toFixed(2)},${height.toFixed(2)} L0,${height.toFixed(
    2,
  )} Z`;
}

function GrowthChart({
  months,
  spaces,
  members,
  proposals,
  locale,
  labels,
}: {
  months: readonly string[];
  spaces: readonly number[];
  members: readonly number[];
  proposals: readonly number[];
  locale: string;
  labels: {
    spaces: string;
    members: string;
    proposals: string;
  };
}) {
  const width = 720;
  const height = 196;
  const pad = { top: 10, right: 8, bottom: 28, left: 8 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const tickEvery = months.length > 8 ? 2 : 1;

  return (
    <svg
      role="img"
      aria-label={`${labels.spaces}, ${labels.members}, ${labels.proposals}`}
      viewBox={`0 0 ${width} ${height}`}
      className="h-44 w-full overflow-visible md:h-48"
    >
      <g transform={`translate(${pad.left} ${pad.top})`}>
        {[0.25, 0.5, 0.75, 1].map((tick) => (
          <line
            key={tick}
            x1="0"
            x2={innerWidth}
            y1={innerHeight * tick}
            y2={innerHeight * tick}
            className="stroke-border/70"
            strokeWidth="1"
          />
        ))}
        <path
          d={seriesPath(spaces, innerWidth, innerHeight, true)}
          fill="color-mix(in oklab, var(--accent-9) 18%, transparent)"
        />
        <path
          d={seriesPath(spaces, innerWidth, innerHeight, false)}
          fill="none"
          stroke="var(--craft-chart-accent-5)"
          strokeWidth="2.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={seriesPath(members, innerWidth, innerHeight, false)}
          fill="none"
          stroke="var(--craft-chart-accent-8)"
          strokeWidth="1.75"
          strokeDasharray="5 4"
          strokeLinejoin="round"
        />
        <path
          d={seriesPath(proposals, innerWidth, innerHeight, false)}
          fill="none"
          stroke="var(--craft-chart-accent-3)"
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        {months.map((month, index) =>
          index % tickEvery === 0 || index === months.length - 1 ? (
            <text
              key={month}
              x={(index / Math.max(months.length - 1, 1)) * innerWidth}
              y={innerHeight + 18}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {formatMonthLabel(month, locale)}
            </text>
          ) : null,
        )}
      </g>
    </svg>
  );
}

function MonthlyBars({
  values,
  label,
}: {
  values: readonly number[];
  label: string;
}) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-20 items-end gap-1" aria-label={label}>
      {values.map((value, index) => (
        <div
          key={`${index}-${value}`}
          className="flex-1 rounded-sm bg-accent-9/80"
          style={{
            height: `${Math.max((value / max) * 100, value > 0 ? 8 : 2)}%`,
          }}
          title={String(value)}
        />
      ))}
    </div>
  );
}

function MixBars({
  items,
  getLabel,
}: {
  items: readonly NamedCount[];
  getLabel: (name: string) => string;
}) {
  const max = Math.max(...items.map((item) => item.count), 1);
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item, index) => (
        <li key={item.name} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-1">
            <span className="min-w-0 truncate text-foreground">
              {getLabel(item.name)}
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {item.count}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-accent-9"
              style={{
                width: `${(item.count / max) * 100}%`,
                opacity: 1 - index * 0.08,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function KpiCard({
  label,
  value,
  hint,
  hintTone = 'muted',
  locale,
}: {
  label: string;
  value: number;
  hint?: string;
  hintTone?: 'muted' | 'positive';
  locale: string;
}) {
  return (
    <Card className="craft-card min-w-0">
      <CardContent className="flex h-full flex-col justify-between gap-3 p-3.5">
        <p className="craft-meta">{label}</p>
        <p
          className="text-7 font-medium tabular-nums tracking-tight text-foreground md:text-8"
          title={formatExact(value, locale)}
        >
          {formatCompact(value, locale)}
        </p>
        <p
          className={cn(
            'min-h-4 text-1',
            hintTone === 'positive'
              ? 'text-success-11'
              : 'text-muted-foreground',
          )}
        >
          {hint ?? '\u00a0'}
        </p>
      </CardContent>
    </Card>
  );
}

export async function NetworkPageHeading() {
  const t = await getTranslations('Network');
  return (
    <h1 className="flex flex-col text-center [font-family:var(--font-family-heading)] text-9 font-medium tracking-[-0.03em] text-secondary-foreground">
      <span>{t('manySpaces')}</span>
      <span>{t('oneVibrantNetwork')}</span>
    </h1>
  );
}

export async function NetworkDashboard({
  stats,
}: {
  stats: NetworkDashboardStats;
}) {
  const t = await getTranslations('Network');
  const locale = await getLocale();
  const activePercent = percentOf(stats.activeSpaceCount, stats.spaceCount);
  const hasGrowth = stats.spacesCumulative.some((value) => value > 0);

  const tokenLabel = (name: string) =>
    isTokenTypeKey(name) ? t(`dashboard.tokenTypes.${name}`) : name;

  return (
    <section
      data-testid="network-dashboard"
      aria-label={t('dashboard.title')}
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          locale={locale}
          label={t('dashboard.spaces')}
          value={stats.spaceCount}
          hint={
            stats.spacesThisMonth > 0
              ? t('dashboard.thisMonth', { count: stats.spacesThisMonth })
              : undefined
          }
          hintTone="positive"
        />
        <KpiCard
          locale={locale}
          label={t('dashboard.activeSpaces')}
          value={stats.activeSpaceCount}
          hint={
            activePercent == null
              ? t('dashboard.activeSpacesHint')
              : t('dashboard.percentOfNetwork', { percent: activePercent })
          }
        />
        <KpiCard
          locale={locale}
          label={t('dashboard.members')}
          value={stats.memberCount}
          hint={
            stats.membersThisMonth > 0
              ? t('dashboard.thisMonth', { count: stats.membersThisMonth })
              : undefined
          }
          hintTone="positive"
        />
        <KpiCard
          locale={locale}
          label={t('dashboard.proposals')}
          value={stats.proposalCount}
          hint={
            stats.proposalsThisMonth > 0
              ? t('dashboard.thisMonth', { count: stats.proposalsThisMonth })
              : undefined
          }
          hintTone="positive"
        />
        <KpiCard
          locale={locale}
          label={t('dashboard.agreements')}
          value={stats.agreementCount}
        />
        <KpiCard
          locale={locale}
          label={t('dashboard.activity24h')}
          value={stats.activityLast24h}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="craft-card lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle>{t('dashboard.growthTitle')}</CardTitle>
            <CardDescription>{t('dashboard.growthSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {hasGrowth ? (
              <>
                <GrowthChart
                  months={stats.months}
                  spaces={stats.spacesCumulative}
                  members={stats.membersCumulative}
                  proposals={stats.proposalsCumulative}
                  locale={locale}
                  labels={{
                    spaces: t('dashboard.spacesSeries'),
                    members: t('dashboard.membersSeries'),
                    proposals: t('dashboard.proposalsSeries'),
                  }}
                />
                <div className="flex flex-wrap gap-4 text-1 text-muted-foreground">
                  <LegendSwatch
                    className="bg-accent-9"
                    label={t('dashboard.spacesSeries')}
                  />
                  <LegendSwatch
                    className="bg-[var(--craft-chart-accent-8)]"
                    label={t('dashboard.membersSeries')}
                  />
                  <LegendSwatch
                    className="bg-[var(--craft-chart-accent-3)]"
                    label={t('dashboard.proposalsSeries')}
                  />
                </div>
              </>
            ) : (
              <p className="craft-meta py-10 text-center">
                {t('dashboard.noData')}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="craft-card">
          <CardHeader className="pb-2">
            <CardTitle>{t('dashboard.spacesThisYear')}</CardTitle>
            <CardDescription>
              {t('dashboard.spacesThisYearHint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <MonthlyBars
              values={stats.spacesByMonth}
              label={t('dashboard.spacesThisYear')}
            />
            <div className="flex items-baseline justify-between gap-3">
              <p className="craft-meta">{t('dashboard.mappedSpaces')}</p>
              <p className="text-5 font-medium tabular-nums">
                {formatCompact(stats.mappedSpaceCount, locale)}
              </p>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <p className="craft-meta">{t('dashboard.tokens')}</p>
              <p className="text-5 font-medium tabular-nums">
                {formatCompact(stats.tokenCount, locale)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="craft-card">
          <CardHeader className="pb-2">
            <CardTitle>{t('dashboard.tokensByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.tokensByType.length > 0 ? (
              <MixBars items={stats.tokensByType} getLabel={tokenLabel} />
            ) : (
              <p className="craft-meta">{t('dashboard.noData')}</p>
            )}
          </CardContent>
        </Card>
        <Card className="craft-card">
          <CardHeader className="pb-2">
            <CardTitle>{t('dashboard.proposalsByType')}</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.proposalsByType.length > 0 ? (
              <MixBars
                items={stats.proposalsByType}
                getLabel={(name) => name}
              />
            ) : (
              <p className="craft-meta">{t('dashboard.noData')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function LegendSwatch({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn('h-0.5 w-3.5 rounded-full', className)} />
      {label}
    </span>
  );
}
