import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  toCumulativeSeries,
  type NetworkDashboardStats,
} from '@hypha-platform/core/client';
import { AnimatedNumber } from './animated-number';
import { formatCompact, formatExact, formatUsd } from './format-network-stats';
import {
  NetworkAreaChart,
  NetworkMixBars,
  NetworkSparkline,
} from './network-charts';
import { NetworkDashboardSkeletonKpi } from './network-dashboard-skeleton';
import { loadNetworkPayingSnapshot } from '../network-paying-loader';

function percentOf(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 100);
}

function KpiCard({
  label,
  value,
  hint,
  hintTone = 'muted',
  locale,
  format = 'compact',
}: {
  label: string;
  value: number;
  hint?: string;
  hintTone?: 'muted' | 'positive';
  locale: string;
  format?: 'compact' | 'usd';
}) {
  return (
    <Card className="craft-card min-w-0">
      <CardContent className="flex h-full flex-col justify-between gap-3 p-3.5">
        <p className="craft-meta">{label}</p>
        <p
          className="text-7 font-medium tabular-nums tracking-tight text-foreground md:text-8"
          title={
            format === 'usd'
              ? formatUsd(value, locale)
              : formatExact(value, locale)
          }
        >
          <AnimatedNumber value={value} locale={locale} format={format} />
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

function SparkStat({
  label,
  value,
  values,
  locale,
  color,
  format = 'compact',
}: {
  label: string;
  value: number;
  values: readonly number[];
  locale: string;
  color: string;
  format?: 'compact' | 'usd';
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="craft-meta">{label}</p>
        <p className="text-4 font-medium tabular-nums tracking-tight">
          {format === 'usd'
            ? formatUsd(value, locale)
            : formatCompact(value, locale)}
        </p>
      </div>
      <NetworkSparkline values={values} color={color} label={label} />
    </div>
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

async function PayingKpis({ locale }: { locale: string }) {
  const t = await getTranslations('Network');
  const paying = await loadNetworkPayingSnapshot();
  if (!paying) {
    return (
      <>
        <KpiCard
          locale={locale}
          label={t('dashboard.currentlyPaying')}
          value={0}
          hint={t('dashboard.payingUnavailable')}
        />
        <KpiCard
          locale={locale}
          label={t('dashboard.totalPaid')}
          value={0}
          format="usd"
          hint={t('dashboard.payingUnavailable')}
        />
      </>
    );
  }

  return (
    <>
      <KpiCard
        locale={locale}
        label={t('dashboard.currentlyPaying')}
        value={paying.currentlyPaying}
        hint={t('dashboard.everPaid', { count: paying.everPaid })}
      />
      <KpiCard
        locale={locale}
        label={t('dashboard.totalPaid')}
        value={paying.paymentUsd}
        format="usd"
        hint={t('dashboard.paymentEvents', { count: paying.paymentEvents })}
      />
    </>
  );
}

async function PayingChart({ locale }: { locale: string }) {
  const t = await getTranslations('Network');
  const paying = await loadNetworkPayingSnapshot();
  const months = paying?.months.map((item) => item.month) ?? [];
  const values = paying?.months.map((item) => item.payingSpaces) ?? [];
  const hasData = values.some((value) => value > 0);

  return (
    <Card className="craft-card">
      <CardHeader className="pb-2">
        <CardTitle>{t('dashboard.payingTitle')}</CardTitle>
        <CardDescription>{t('dashboard.payingSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {hasData ? (
          <>
            <NetworkAreaChart
              months={months}
              values={values}
              locale={locale}
              color="var(--craft-chart-accent-5)"
              ariaLabel={t('dashboard.payingChartAria')}
              emptyLabel={t('dashboard.payingEmpty')}
              valueLabel={t('dashboard.currentlyPaying')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SparkStat
                locale={locale}
                label={t('dashboard.paymentsSeries')}
                value={paying?.paymentEvents ?? 0}
                values={toCumulativeSeries(
                  paying?.months.map((item) => item.paymentCount) ?? [],
                )}
                color="var(--craft-chart-accent-8)"
              />
              <SparkStat
                locale={locale}
                label={t('dashboard.paidSeries')}
                value={paying?.paymentUsd ?? 0}
                values={toCumulativeSeries(
                  paying?.months.map((item) => item.paymentUsd) ?? [],
                )}
                format="usd"
                color="var(--craft-chart-accent-3)"
              />
            </div>
          </>
        ) : (
          <p className="craft-meta py-10 text-center">
            {t('dashboard.payingEmpty')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function PayingKpisFallback() {
  return (
    <>
      <NetworkDashboardSkeletonKpi />
      <NetworkDashboardSkeletonKpi />
    </>
  );
}

function PayingChartFallback() {
  return (
    <Card className="craft-card">
      <CardContent className="p-3.5">
        <div className="mb-4 h-4 w-40 rounded-md bg-muted/50" />
        <div className="h-48 rounded-md bg-muted/40 md:h-56" />
      </CardContent>
    </Card>
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
        <Suspense fallback={<PayingKpisFallback />}>
          <PayingKpis locale={locale} />
        </Suspense>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card className="craft-card">
          <CardHeader className="pb-2">
            <CardTitle>{t('dashboard.growthTitle')}</CardTitle>
            <CardDescription>{t('dashboard.growthSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {hasGrowth ? (
              <>
                <NetworkAreaChart
                  months={stats.months}
                  values={stats.spacesCumulative}
                  locale={locale}
                  color="var(--craft-chart-accent-5)"
                  ariaLabel={t('dashboard.growthChartAria')}
                  emptyLabel={t('dashboard.noData')}
                  valueLabel={t('dashboard.spacesSeries')}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <SparkStat
                    locale={locale}
                    label={t('dashboard.membersSeries')}
                    value={stats.memberCount}
                    values={stats.membersCumulative}
                    color="var(--craft-chart-accent-8)"
                  />
                  <SparkStat
                    locale={locale}
                    label={t('dashboard.proposalsSeries')}
                    value={stats.proposalCount}
                    values={stats.proposalsCumulative}
                    color="var(--craft-chart-accent-3)"
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

        <Suspense fallback={<PayingChartFallback />}>
          <PayingChart locale={locale} />
        </Suspense>
      </div>

      <Card className="craft-card">
        <CardHeader className="pb-2">
          <CardTitle>{t('dashboard.proposalsByType')}</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.proposalsByType.length > 0 ? (
            <NetworkMixBars items={stats.proposalsByType} />
          ) : (
            <p className="craft-meta">{t('dashboard.noData')}</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
