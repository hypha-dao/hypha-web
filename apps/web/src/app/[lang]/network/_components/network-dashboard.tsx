import { getLocale, getTranslations } from 'next-intl/server';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@hypha-platform/ui';
import { type NetworkDashboardStats } from '@hypha-platform/core/client';
import { AnimatedNumber } from './animated-number';
import { formatCompact, formatExact } from './format-network-stats';
import { NetworkAreaChart, NetworkSparkline } from './network-charts';

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
          <AnimatedNumber value={value} locale={locale} />
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
  locale,
  color,
}: {
  label: string;
  value: number;
  values: readonly number[];
  locale: string;
  color: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="craft-meta">{label}</p>
        <p className="text-4 font-medium tabular-nums tracking-tight">
          {formatCompact(value, locale)}
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
        <KpiCard
          locale={locale}
          label={t('dashboard.activeSpaces')}
          value={stats.activeSpaceCount}
          hint={
            activePercent == null
              ? t('dashboard.activeSpacesHint')
              : t('dashboard.activeSpacesShare', { percent: activePercent })
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
      </div>

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

      <p className="text-center text-1 text-muted-foreground">
        {t('dashboard.scopeNote')}
      </p>
    </section>
  );
}
