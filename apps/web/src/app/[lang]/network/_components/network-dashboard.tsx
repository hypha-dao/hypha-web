import { getLocale, getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';
import {
  toCumulativeSeries,
  type NetworkDashboardStats,
} from '@hypha-platform/core/client';
import { AnimatedNumber } from './animated-number';
import { formatCompact, formatExact, formatUsd } from './format-network-stats';
import { NetworkAreaChart, NetworkSparkline } from './network-charts';
import { NetworkDashboardSkeletonKpi } from './network-dashboard-skeleton';
import { loadNetworkPayingSnapshot } from '../network-paying-loader';
import { loadNetworkTreasurySnapshot } from '../network-treasury-loader';

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
          className={
            hintTone === 'positive'
              ? 'min-h-4 text-1 text-success-11'
              : 'min-h-4 text-1 text-muted-foreground'
          }
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
  months,
  locale,
  color,
  format = 'compact',
}: {
  label: string;
  value: number;
  values: readonly number[];
  months: readonly string[];
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
      <NetworkSparkline
        values={values}
        months={months}
        locale={locale}
        color={color}
        label={label}
        valueFormat={format}
      />
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

async function ContributingKpi({ locale }: { locale: string }) {
  const t = await getTranslations('Network');
  const paying = await loadNetworkPayingSnapshot();
  if (!paying) {
    return (
      <KpiCard
        locale={locale}
        label={t('dashboard.contributingSpaces')}
        value={0}
        hint={t('dashboard.contributingUnavailable')}
      />
    );
  }

  return (
    <KpiCard
      locale={locale}
      label={t('dashboard.contributingSpaces')}
      value={paying.currentlyPaying}
      hint={t('dashboard.everContributed', { count: paying.everPaid })}
    />
  );
}

async function AumKpi({ locale }: { locale: string }) {
  const t = await getTranslations('Network');
  const treasury = await loadNetworkTreasurySnapshot();
  return (
    <KpiCard
      locale={locale}
      label={t('dashboard.aum')}
      value={treasury?.aumUsd ?? 0}
      format="usd"
      hint={
        treasury
          ? t('dashboard.aumHint', { count: treasury.treasuryCount })
          : t('dashboard.aumUnavailable')
      }
    />
  );
}

async function TransactionsKpi({ locale }: { locale: string }) {
  const t = await getTranslations('Network');
  const treasury = await loadNetworkTreasurySnapshot();
  if (!treasury) {
    return (
      <KpiCard
        locale={locale}
        label={t('dashboard.transactions')}
        value={0}
        hint={t('dashboard.transactionsUnavailable')}
      />
    );
  }

  return (
    <KpiCard
      locale={locale}
      label={t('dashboard.transactions')}
      value={treasury.transactionCount}
      hint={
        treasury.transactionsThisMonth > 0
          ? t('dashboard.thisMonth', { count: treasury.transactionsThisMonth })
          : t('dashboard.transactionsHint')
      }
      hintTone={treasury.transactionsThisMonth > 0 ? 'positive' : 'muted'}
    />
  );
}

async function DashboardCharts({
  stats,
  locale,
}: {
  stats: NetworkDashboardStats;
  locale: string;
}) {
  const t = await getTranslations('Network');
  const paying = await loadNetworkPayingSnapshot();
  const contributingMonths = paying?.months.map((item) => item.month) ?? [];
  const contributingValues =
    paying?.months.map((item) => item.payingSpaces) ?? [];
  const hasContributing = contributingValues.some((value) => value > 0);
  const hasGrowth = stats.spacesCumulative.some((value) => value > 0);

  return (
    <div
      className={
        hasContributing
          ? 'grid grid-cols-1 gap-3 lg:grid-cols-2'
          : 'grid grid-cols-1 gap-3'
      }
    >
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
                  months={stats.months}
                  label={t('dashboard.membersSeries')}
                  value={stats.memberCount}
                  values={stats.membersCumulative}
                  color="var(--craft-chart-accent-8)"
                />
                <SparkStat
                  locale={locale}
                  months={stats.months}
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

      {hasContributing ? (
        <Card className="craft-card">
          <CardHeader className="pb-2">
            <CardTitle>{t('dashboard.contributingTitle')}</CardTitle>
            <CardDescription>
              {t('dashboard.contributingSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <NetworkAreaChart
              months={contributingMonths}
              values={contributingValues}
              locale={locale}
              color="var(--craft-chart-accent-5)"
              ariaLabel={t('dashboard.contributingChartAria')}
              emptyLabel={t('dashboard.contributingEmpty')}
              valueLabel={t('dashboard.contributingSpaces')}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <SparkStat
                locale={locale}
                months={contributingMonths}
                label={t('dashboard.paymentsSeries')}
                value={paying?.paymentEvents ?? 0}
                values={toCumulativeSeries(
                  paying?.months.map((item) => item.paymentCount) ?? [],
                )}
                color="var(--craft-chart-accent-8)"
              />
              <SparkStat
                locale={locale}
                months={contributingMonths}
                label={t('dashboard.paidSeries')}
                value={paying?.paymentUsd ?? 0}
                values={toCumulativeSeries(
                  paying?.months.map((item) => item.paymentUsd) ?? [],
                )}
                format="usd"
                color="var(--craft-chart-accent-3)"
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function KpiFallback() {
  return <NetworkDashboardSkeletonKpi />;
}

function ChartFallback() {
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

  return (
    <section
      data-testid="network-dashboard"
      aria-label={t('dashboard.title')}
      className="flex min-w-0 flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
        <Suspense fallback={<KpiFallback />}>
          <ContributingKpi locale={locale} />
        </Suspense>
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Suspense fallback={<KpiFallback />}>
          <AumKpi locale={locale} />
        </Suspense>
        <Suspense fallback={<KpiFallback />}>
          <TransactionsKpi locale={locale} />
        </Suspense>
      </div>

      <Suspense fallback={<ChartFallback />}>
        <DashboardCharts stats={stats} locale={locale} />
      </Suspense>

      <p className="text-center text-1 text-muted-foreground">
        {t('dashboard.scopeNote')}
      </p>
    </section>
  );
}
