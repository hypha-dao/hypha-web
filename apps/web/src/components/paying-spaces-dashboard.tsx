'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { useLocale, useTranslations } from 'next-intl';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import {
  previousMonthKey,
  type PayingSpacesDashboardData,
} from '@hypha-platform/core/client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@hypha-platform/ui';

const CHART_CARD_CLASS =
  'min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background-2 shadow-none';

const PAYING_COLOR = 'var(--craft-chart-accent-5)';
const PAYMENT_USD_COLOR = 'var(--craft-chart-accent-3)';
const CHART_WIDTH = 760;
const CHART_HEIGHT = 340;

type PayingSpacesResponse = PayingSpacesDashboardData & {
  found: boolean;
  space_slug: string;
};

type ChartPoint = {
  month: string;
  value: number;
  title: string;
};

function formatMonthLabel(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split('-').map((part) => Number(part));
  if (!year || !month) return monthKey;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

function formatUsd(value: number, locale: string, compact = false): string {
  const abs = Math.abs(value);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    notation: compact && abs >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: compact && abs >= 1000 ? 1 : abs >= 100 ? 0 : 2,
  }).format(value);
}

async function fetchPayingSpaces(
  slug: string,
  getAccessToken: (() => Promise<string | null>) | undefined,
): Promise<PayingSpacesResponse> {
  const token = await getAccessToken?.();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`/api/v1/spaces/${slug}/paying-spaces`, {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to load paying spaces (${response.status})`);
  }
  return (await response.json()) as PayingSpacesResponse;
}

function integerAxisTicks(maxValue: number): number[] {
  if (maxValue <= 6) {
    return Array.from({ length: maxValue + 1 }, (_, index) => index);
  }
  const step = Math.max(1, Math.ceil(maxValue / 4));
  const ticks: number[] = [];
  for (let value = 0; value <= maxValue; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== maxValue) {
    ticks.push(maxValue);
  }
  return ticks;
}

function PayingSpacesDashboardSkeleton() {
  return (
    <div
      className="@container/paying-spaces flex flex-col gap-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} loading={true} className="h-[88px] w-full" />
        ))}
      </div>
      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] @[64rem]/paying-spaces:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-4">
          <Skeleton loading={true} className="h-[340px] w-full" />
          <Skeleton loading={true} className="h-[340px] w-full" />
        </div>
        <Skeleton loading={true} className="h-full min-h-[340px] w-full" />
      </div>
    </div>
  );
}

function PayingSpacesLineChart({
  points,
  locale,
  color,
  ariaLabel,
  emptyLabel,
  formatTick,
  integerTicks = false,
}: {
  points: ChartPoint[];
  locale: string;
  color: string;
  ariaLabel: string;
  emptyLabel: string;
  formatTick: (value: number) => string;
  integerTicks?: boolean;
}) {
  const maxValue = React.useMemo(
    () => Math.max(integerTicks ? 1 : 0, ...points.map((item) => item.value)),
    [integerTicks, points],
  );
  const yMax = maxValue > 0 ? maxValue : 1;
  const margin = {
    top: 18,
    right: 22,
    bottom: 56,
    left: integerTicks ? 44 : 56,
  };
  const innerWidth = CHART_WIDTH - margin.left - margin.right;
  const innerHeight = CHART_HEIGHT - margin.top - margin.bottom;
  const x = d3
    .scalePoint<string>()
    .domain(points.map((item) => item.month))
    .range([0, innerWidth])
    .padding(0.5);
  const y = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]).nice();
  const axisTicks = integerTicks ? integerAxisTicks(yMax) : y.ticks(4);
  const line = d3
    .line<ChartPoint>()
    .x((item) => x(item.month) ?? 0)
    .y((item) => y(item.value))
    .curve(d3.curveMonotoneX);
  const area = d3
    .area<ChartPoint>()
    .x((item) => x(item.month) ?? 0)
    .y0(innerHeight)
    .y1((item) => y(item.value))
    .curve(d3.curveMonotoneX);
  const monthLabelStep = Math.max(1, Math.floor(points.length / 12));
  const descId = React.useId();
  const description = points.map((item) => item.title).join('; ');

  if (points.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-auto w-full max-h-[340px]"
        role="img"
        aria-label={ariaLabel}
        aria-describedby={descId}
      >
        <desc id={descId}>{description}</desc>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {axisTicks.map((tick) => (
            <g key={tick} transform={`translate(0,${y(tick)})`}>
              <line
                x1={0}
                x2={innerWidth}
                stroke="var(--border)"
                strokeDasharray="1.5 4"
                opacity={0.45}
              />
              <text
                x={-8}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {integerTicks ? Math.round(tick) : formatTick(tick)}
              </text>
            </g>
          ))}

          <path
            d={area(points) ?? ''}
            fill="color-mix(in oklab, var(--space-accent, var(--accent-9)) 16%, transparent)"
          />
          <path
            d={line(points) ?? ''}
            fill="none"
            stroke={color}
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((item, index) => {
            const monthX = x(item.month) ?? 0;
            const showLabel =
              index % monthLabelStep === 0 || index === points.length - 1;
            return (
              <g key={item.month}>
                <circle
                  cx={monthX}
                  cy={y(item.value)}
                  r={item.value > 0 ? 3 : 1.5}
                  fill="var(--color-background-2, var(--background))"
                  stroke={color}
                  strokeWidth={1.5}
                >
                  <title>{item.title}</title>
                </circle>
                {showLabel ? (
                  <text
                    x={monthX}
                    y={innerHeight + 20}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {formatMonthLabel(item.month, locale)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export function PayingSpacesDashboard({ spaceSlug }: { spaceSlug: string }) {
  const { getAccessToken, isAuthenticated, isAuthLoading, accessTokenReady } =
    useAccessTokenReady();
  const locale = useLocale();
  const t = useTranslations('TokenHoldingsDashboard.payingSpaces');
  const authReady = !isAuthLoading && accessTokenReady;
  const authKey = isAuthenticated ? 'auth' : 'anon';
  const { data, error, isLoading } = useSWR(
    authReady ? ['platform-paying-spaces-v4', spaceSlug, authKey] : null,
    ([, slug]) => fetchPayingSpaces(slug, getAccessToken),
    { revalidateOnFocus: true, refreshInterval: 15 * 60_000 },
  );
  const loading = !authReady || isLoading;
  const [selectedSpaceId, setSelectedSpaceId] = React.useState<string>('all');

  React.useEffect(() => {
    if (!data?.spaces.length) return;
    setSelectedSpaceId((current) =>
      current === 'all' ||
      data.spaces.some((space) => String(space.web3SpaceId) === current)
        ? current
        : 'all',
    );
  }, [data?.spaces]);

  const chartMonthly = React.useMemo(() => {
    const monthly = data?.monthly ?? [];
    const mapped =
      selectedSpaceId === 'all'
        ? monthly.map((bucket) => ({
            month: bucket.month,
            paying: bucket.payingSpaces,
            payments: bucket.paymentCount,
            paymentUsd: bucket.paymentUsd ?? 0,
          }))
        : monthly.map((bucket) => {
            const web3SpaceId = Number(selectedSpaceId);
            const point = bucket.spaces.find(
              (space) => space.web3SpaceId === web3SpaceId,
            );
            return {
              month: bucket.month,
              paying: point?.paying ? 1 : 0,
              payments: point?.paymentCount ?? 0,
              paymentUsd: point?.paymentUsd ?? 0,
            };
          });
    if (mapped.length !== 1) return mapped;
    const only = mapped[0]!;
    const baselineMonth = previousMonthKey(only.month);
    if (!baselineMonth) return mapped;
    return [
      { month: baselineMonth, paying: 0, payments: 0, paymentUsd: 0 },
      only,
    ];
  }, [data?.monthly, selectedSpaceId]);

  const latest = chartMonthly.at(-1);
  const totals = React.useMemo(
    () => ({
      paying: latest?.paying ?? 0,
      payments: chartMonthly.reduce((sum, item) => sum + item.payments, 0),
      paymentUsd: chartMonthly.reduce(
        (sum, item) => sum + (item.paymentUsd ?? 0),
        0,
      ),
    }),
    [chartMonthly, latest],
  );

  const selectedSpace = data?.spaces.find(
    (space) => String(space.web3SpaceId) === selectedSpaceId,
  );

  if (loading) {
    return <PayingSpacesDashboardSkeleton />;
  }

  if (error) {
    return (
      <Card className={CHART_CARD_CLASS}>
        <CardHeader>
          <CardTitle className="text-4 font-medium tracking-tight">
            {t('title')}
          </CardTitle>
          <CardDescription>{t('error')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="@container/paying-spaces flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className={CHART_CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-3 font-normal text-muted-foreground">
              {t('currentlyPaying')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-6 font-semibold tabular-nums">
              {data?.summary.currentlyPaying ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card className={CHART_CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-3 font-normal text-muted-foreground">
              {t('everPaid')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-6 font-semibold tabular-nums">
              {data?.summary.everPaid ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card className={CHART_CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-3 font-normal text-muted-foreground">
              {t('paymentEvents')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-6 font-semibold tabular-nums">
              {data?.summary.paymentEvents ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card className={CHART_CARD_CLASS}>
          <CardHeader className="pb-2">
            <CardTitle className="text-3 font-normal text-muted-foreground">
              {t('totalPaid')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-6 font-semibold tabular-nums">
              {formatUsd(data?.summary.paymentUsd ?? 0, locale)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] @[64rem]/paying-spaces:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 content-start gap-4">
          <Card className={`${CHART_CARD_CLASS} flex h-full flex-col`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-4 font-medium tracking-tight">
                {t('title')}
              </CardTitle>
              <CardDescription className="text-1 text-muted-foreground">
                {t('subtitle')}
              </CardDescription>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-1 text-muted-foreground">
                <span className="tabular-nums">
                  <span className="text-foreground">{totals.paying}</span>{' '}
                  {selectedSpace ? selectedSpace.title : t('payingCount')}
                </span>
                <span className="tabular-nums">
                  <span className="text-foreground">{totals.payments}</span>{' '}
                  {t('paymentsInView')}
                </span>
                {data?.fromMonth ? (
                  <span>
                    {t('fromMonth', {
                      month: formatMonthLabel(data.fromMonth, locale),
                    })}
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-3 pb-5">
              <PayingSpacesLineChart
                points={chartMonthly.map((item) => ({
                  month: item.month,
                  value: item.paying,
                  title: `${formatMonthLabel(item.month, locale)}: ${
                    item.paying
                  } · ${item.payments}`,
                }))}
                locale={locale}
                color={PAYING_COLOR}
                ariaLabel={t('chartAria')}
                emptyLabel={t('empty')}
                formatTick={(value) => String(Math.round(value))}
                integerTicks
              />
            </CardContent>
          </Card>

          <Card className={`${CHART_CARD_CLASS} flex h-full flex-col`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-4 font-medium tracking-tight">
                {t('paymentUsdTitle')}
              </CardTitle>
              <CardDescription className="text-1 text-muted-foreground">
                {t('paymentUsdSubtitle')}
              </CardDescription>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-1 text-muted-foreground">
                <span className="tabular-nums">
                  <span className="text-foreground">
                    {formatUsd(totals.paymentUsd, locale)}
                  </span>{' '}
                  {t('paymentUsdInView')}
                </span>
                {data?.fromMonth ? (
                  <span>
                    {t('fromMonth', {
                      month: formatMonthLabel(data.fromMonth, locale),
                    })}
                  </span>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col space-y-3 pb-5">
              <PayingSpacesLineChart
                points={chartMonthly.map((item) => ({
                  month: item.month,
                  value: item.paymentUsd,
                  title: `${formatMonthLabel(item.month, locale)}: ${formatUsd(
                    item.paymentUsd,
                    locale,
                  )}`,
                }))}
                locale={locale}
                color={PAYMENT_USD_COLOR}
                ariaLabel={t('paymentUsdChartAria')}
                emptyLabel={t('empty')}
                formatTick={(value) => formatUsd(value, locale, true)}
              />
            </CardContent>
          </Card>
        </div>
        <div className="flex min-h-0 min-w-0 flex-col">
          <Card className={`${CHART_CARD_CLASS} flex h-full flex-col`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-4 font-medium tracking-tight">
                {t('spaceLabel')}
              </CardTitle>
              <select
                value={selectedSpaceId}
                aria-label={t('spaceLabel')}
                onChange={(event) => setSelectedSpaceId(event.target.value)}
                className="mt-2 h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">{t('spaceAll')}</option>
                {(data?.spaces ?? []).map((space) => (
                  <option
                    key={space.web3SpaceId}
                    value={String(space.web3SpaceId)}
                  >
                    {space.title}
                  </option>
                ))}
              </select>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col pb-5">
              {(data?.spaces ?? []).length > 0 ? (
                <div className="grid min-h-0 flex-1 gap-1 overflow-y-auto">
                  {(data?.spaces ?? []).map((space) => {
                    const selected =
                      String(space.web3SpaceId) === selectedSpaceId;
                    return (
                      <button
                        key={space.web3SpaceId}
                        type="button"
                        aria-pressed={selected}
                        onClick={() =>
                          setSelectedSpaceId((current) =>
                            current === String(space.web3SpaceId)
                              ? 'all'
                              : String(space.web3SpaceId),
                          )
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/40"
                        style={{
                          background: selected
                            ? 'color-mix(in oklab, var(--space-accent, var(--accent-9)) 10%, transparent)'
                            : undefined,
                        }}
                      >
                        <span className="truncate text-foreground">
                          {space.title}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {space.currentlyPaying
                            ? t('currentlyPaying')
                            : t('notCurrentlyPaying')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
