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

type PayingSpacesResponse = PayingSpacesDashboardData & {
  found: boolean;
  space_slug: string;
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

export function PayingSpacesDashboard({ spaceSlug }: { spaceSlug: string }) {
  const { getAccessToken, isAuthenticated, isAuthLoading, accessTokenReady } =
    useAccessTokenReady();
  const locale = useLocale();
  const t = useTranslations('TokenHoldingsDashboard.payingSpaces');
  const authReady = !isAuthLoading && accessTokenReady;
  const authKey = isAuthenticated ? 'auth' : 'anon';
  const { data, error, isLoading } = useSWR(
    authReady ? ['platform-paying-spaces', spaceSlug, authKey] : null,
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
            };
          });
    if (mapped.length !== 1) return mapped;
    const only = mapped[0]!;
    const baselineMonth = previousMonthKey(only.month);
    if (!baselineMonth) return mapped;
    return [{ month: baselineMonth, paying: 0, payments: 0 }, only];
  }, [data?.monthly, selectedSpaceId]);

  const maxValue = React.useMemo(
    () => Math.max(1, ...chartMonthly.map((item) => item.paying)),
    [chartMonthly],
  );
  const latest = chartMonthly.at(-1);
  const totals = React.useMemo(
    () => ({
      paying: latest?.paying ?? 0,
      payments: chartMonthly.reduce((sum, item) => sum + item.payments, 0),
    }),
    [chartMonthly, latest],
  );

  const width = 760;
  const height = 340;
  const margin = { top: 18, right: 22, bottom: 56, left: 44 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3
    .scalePoint<string>()
    .domain(chartMonthly.map((item) => item.month))
    .range([0, innerWidth])
    .padding(0.5);
  const y = d3
    .scaleLinear()
    .domain([0, maxValue])
    .range([innerHeight, 0])
    .nice();
  const axisTicks = React.useMemo(() => {
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
  }, [maxValue]);
  const line = d3
    .line<(typeof chartMonthly)[number]>()
    .x((item) => x(item.month) ?? 0)
    .y((item) => y(item.paying))
    .curve(d3.curveMonotoneX);
  const area = d3
    .area<(typeof chartMonthly)[number]>()
    .x((item) => x(item.month) ?? 0)
    .y0(innerHeight)
    .y1((item) => y(item.paying))
    .curve(d3.curveMonotoneX);
  const monthLabelStep = Math.max(1, Math.floor(chartMonthly.length / 12));
  const selectedSpace = data?.spaces.find(
    (space) => String(space.web3SpaceId) === selectedSpaceId,
  );

  if (loading) {
    return <Skeleton className="h-[340px] w-full" />;
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
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

      <div className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
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
              {chartMonthly.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
              ) : (
                <div className="overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="min-w-[620px] w-full"
                    role="img"
                    aria-label={t('chartAria')}
                  >
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
                            {Math.round(tick)}
                          </text>
                        </g>
                      ))}

                      <path
                        d={area(chartMonthly) ?? ''}
                        fill="color-mix(in oklab, var(--space-accent, var(--accent-9)) 16%, transparent)"
                      />
                      <path
                        d={line(chartMonthly) ?? ''}
                        fill="none"
                        stroke={PAYING_COLOR}
                        strokeWidth={1.75}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />

                      {chartMonthly.map((item, index) => {
                        const monthX = x(item.month) ?? 0;
                        const showLabel =
                          index % monthLabelStep === 0 ||
                          index === chartMonthly.length - 1;
                        return (
                          <g key={item.month}>
                            <circle
                              cx={monthX}
                              cy={y(item.paying)}
                              r={item.paying > 0 ? 3 : 1.5}
                              fill="var(--color-background-2, var(--background))"
                              stroke={PAYING_COLOR}
                              strokeWidth={1.5}
                            >
                              <title>
                                {`${formatMonthLabel(item.month, locale)}: ${
                                  item.paying
                                } · ${item.payments}`}
                              </title>
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
              )}
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
