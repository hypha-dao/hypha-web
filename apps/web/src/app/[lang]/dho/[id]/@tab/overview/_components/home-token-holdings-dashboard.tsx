'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { useAuthentication } from '@hypha-platform/authentication';
import { useLocale, useTranslations } from 'next-intl';
import { CircleHelp } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@hypha-platform/ui';

type TokenHoldingResponse = {
  found: boolean;
  space_slug: string;
  asOf: string;
  tokens: Array<{
    token_id: number | null;
    token_address: string;
    name: string;
    symbol: string;
    icon_url: string | null;
    type: string;
    decimals: number;
    max_supply: string | number | null;
    total_supply: string;
    holdings: Array<{
      holder_kind: 'person' | 'space' | 'treasury' | 'other';
      address: string | null;
      display_name: string;
      slug: string | null;
      balance: string;
      balance_raw: string;
      share_pct: number;
    }>;
    treasury_balance: string;
    other_balance: string;
    total_holders_balance: string;
  }>;
};

type ChartSlice = TokenHoldingResponse['tokens'][number]['holdings'][number] & {
  numeric: number;
};

type ActivityResponse = {
  found: boolean;
  space_slug: string;
  asOf: string;
  energy: {
    available: boolean;
  };
  proposals: {
    onVoting: number;
    accepted: number;
    refused: number;
  };
  signals: {
    total: number;
    priorities: string[];
    types: string[];
    matrix: Array<{
      priority: string;
      type: string;
      count: number;
    }>;
  };
  members: {
    monthly: Array<{
      month: string;
      people: number;
      spaces: number;
    }>;
  };
};

type HomeSectionFilter = 'all' | 'energy' | 'activity' | 'distribution';

const PERCENTAGE_FORMATTER = d3.format('.1f');
const COLOR_RANGE = [
  'var(--space-accent, var(--accent-9))',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 72%, var(--color-info-9, var(--info-9)) 28%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 72%, var(--color-success-9, var(--success-9)) 28%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 72%, var(--color-warning-9, var(--warning-9)) 28%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 82%, white 18%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 84%, black 16%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 60%, var(--color-info-10, var(--info-10)) 40%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 60%, var(--color-success-10, var(--success-10)) 40%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 60%, var(--color-warning-10, var(--warning-10)) 40%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 74%, var(--color-neutral-9, var(--neutral-9)) 26%)',
];

function toNumericValue(raw: string): number {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatAmount(raw: string, locale: string): string {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return raw;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(parsed);
}

function prettifyTokenType(type: string): string {
  return type
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function capitalizeWords(value: string): string {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

function fetchHoldings(
  slug: string,
  getAccessToken: (() => Promise<string | null>) | undefined,
) {
  return async (): Promise<TokenHoldingResponse> => {
    const token = await getAccessToken?.();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `/api/v1/spaces/${slug}/token-holdings?include_treasury=true`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to load token holdings (${response.status})`);
    }
    return (await response.json()) as TokenHoldingResponse;
  };
}

function fetchOverviewActivity(
  slug: string,
  getAccessToken: (() => Promise<string | null>) | undefined,
) {
  return async (): Promise<ActivityResponse> => {
    const token = await getAccessToken?.();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api/v1/spaces/${slug}/overview-activity`, {
      headers,
    });
    if (!response.ok) {
      throw new Error(`Failed to load overview activity (${response.status})`);
    }
    return (await response.json()) as ActivityResponse;
  };
}

function formatMonthLabel(monthKey: string, locale: string): string {
  const [year, month] = monthKey.split('-').map((part) => Number(part));
  if (!year || !month) return monthKey;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

function TokenDonutChart({
  title,
  slices,
  locale,
}: {
  title: string;
  slices: TokenHoldingResponse['tokens'][number]['holdings'];
  locale: string;
}) {
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const chartData = React.useMemo(
    () =>
      slices
        .map((slice) => ({ ...slice, numeric: toNumericValue(slice.balance) }))
        .filter((slice) => slice.numeric > 0),
    [slices],
  );

  const pieData = React.useMemo(
    () =>
      d3.pie<ChartSlice>().value((item: ChartSlice) => item.numeric)(chartData),
    [chartData],
  );

  const outerRadius = 128;
  const innerRadius = 74;
  const arcGenerator = React.useMemo(
    () =>
      d3
        .arc<d3.PieArcDatum<ChartSlice>>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius),
    [],
  );

  const colorScale = React.useMemo(() => {
    const domain = chartData.map((slice) => slice.display_name);
    return d3.scaleOrdinal<string, string>().domain(domain).range(COLOR_RANGE);
  }, [chartData]);

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
      <div className="relative flex items-center justify-center md:flex-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-64 w-64 rounded-full opacity-90 blur-3xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--space-accent, var(--accent-9)) 40%, transparent) 0%, transparent 72%)',
          }}
        />
        <svg
          viewBox="-145 -145 290 290"
          role="img"
          aria-label={tTokenHoldings('chartAria', { title })}
          className="h-80 w-80 transition-transform duration-300 ease-out group-hover:scale-[1.03]"
        >
          {pieData.map((segment: d3.PieArcDatum<ChartSlice>) => (
            <path
              key={`${segment.data.display_name}-${segment.index}`}
              d={arcGenerator(segment) ?? ''}
              fill={colorScale(segment.data.display_name)}
              stroke="var(--background)"
              strokeWidth={1}
            />
          ))}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-[15px] font-semibold"
          >
            {title}
          </text>
        </svg>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 md:max-w-[28%]">
        {chartData.map((slice) => (
          <div
            key={`${slice.display_name}-${slice.address ?? 'other'}`}
            className="flex items-center justify-between gap-2 rounded-md px-1 py-0.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: colorScale(slice.display_name) }}
              />
              <span className="truncate text-sm text-foreground/90">
                {slice.display_name}
              </span>
            </div>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {PERCENTAGE_FORMATTER(slice.share_pct)}% ·{' '}
              {formatAmount(slice.balance, locale)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProposalsPieWidget({ data }: { data: ActivityResponse['proposals'] }) {
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const pieData = React.useMemo(
    () => [
      {
        label: tTokenHoldings('proposals.onVoting'),
        value: data.onVoting,
        color: 'var(--info-9)',
      },
      {
        label: tTokenHoldings('proposals.accepted'),
        value: data.accepted,
        color: 'var(--success-9)',
      },
      {
        label: tTokenHoldings('proposals.refused'),
        value: data.refused,
        color: 'var(--error-9)',
      },
    ],
    [data.accepted, data.onVoting, data.refused, tTokenHoldings],
  );

  const total = pieData.reduce((sum, item) => sum + item.value, 0);
  const chartInput =
    total > 0
      ? pieData
      : [
          {
            label: tTokenHoldings('proposals.noData'),
            value: 1,
            color: 'var(--neutral-6)',
          },
        ];
  const arcs = d3
    .pie<(typeof chartInput)[number]>()
    .value((item) => item.value)(chartInput);
  const arc = d3
    .arc<d3.PieArcDatum<(typeof chartInput)[number]>>()
    .innerRadius(68)
    .outerRadius(112);

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">
          {tTokenHoldings('proposals.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {tTokenHoldings('proposals.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-[420px] grid-cols-[1fr_auto] items-center gap-2">
        <svg
          viewBox="-130 -130 260 260"
          className="h-[340px] w-full"
          aria-label={tTokenHoldings('proposals.ariaLabel')}
        >
          {arcs.map((slice, index) => (
            <path
              key={`${slice.data.label}-${index}`}
              d={arc(slice) ?? ''}
              fill={slice.data.color}
              stroke="var(--background)"
              strokeWidth={1}
            />
          ))}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-[22px] font-semibold"
          >
            {total}
          </text>
        </svg>

        <div className="flex min-w-[180px] flex-col gap-3 pr-2 text-sm">
          {pieData.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between gap-3"
            >
              <span className="inline-flex min-w-0 items-center gap-2 text-foreground/90">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate">{item.label}</span>
              </span>
              <span className="text-lg font-semibold text-foreground">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function MembersEvolutionWidget({
  monthly,
  locale,
}: {
  monthly: ActivityResponse['members']['monthly'];
  locale: string;
}) {
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const maxValue = React.useMemo(
    () =>
      Math.max(1, ...monthly.map((item) => Math.max(item.people, item.spaces))),
    [monthly],
  );

  const width = 980;
  const height = 420;
  const margin = { top: 18, right: 18, bottom: 64, left: 42 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x0 = d3
    .scaleBand<string>()
    .domain(monthly.map((item) => item.month))
    .range([0, innerWidth])
    .padding(0.18);
  const x1 = d3
    .scaleBand<string>()
    .domain(['people', 'spaces'])
    .range([0, x0.bandwidth()])
    .padding(0.2);
  const y = d3
    .scaleLinear()
    .domain([0, maxValue])
    .nice()
    .range([innerHeight, 0]);

  return (
    <Card className="border-border/60 bg-card/95 md:col-span-2">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">
          {tTokenHoldings('members.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {tTokenHoldings('members.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {[0, maxValue / 2, maxValue].map((tick) => (
              <g key={tick} transform={`translate(0,${y(tick)})`}>
                <line
                  x1={innerWidth}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />
                <text
                  x={-8}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {Math.round(tick)}
                </text>
              </g>
            ))}

            {monthly.map((item) => {
              const monthX = x0(item.month) ?? 0;
              return (
                <g key={item.month} transform={`translate(${monthX},0)`}>
                  <rect
                    x={x1('people')}
                    y={y(item.people)}
                    width={x1.bandwidth()}
                    height={innerHeight - y(item.people)}
                    fill="var(--space-accent, var(--accent-9))"
                    rx={3}
                  />
                  <rect
                    x={x1('spaces')}
                    y={y(item.spaces)}
                    width={x1.bandwidth()}
                    height={innerHeight - y(item.spaces)}
                    fill="color-mix(in oklab, var(--space-accent, var(--accent-9)) 55%, var(--info-9) 45%)"
                    rx={3}
                  />
                  <text
                    x={x0.bandwidth() / 2}
                    y={innerHeight + 20}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[11px]"
                  >
                    {formatMonthLabel(item.month, locale)}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>

        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: 'var(--space-accent, var(--accent-9))' }}
            />
            {tTokenHoldings('members.people')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{
                background:
                  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 55%, var(--info-9) 45%)',
              }}
            />
            {tTokenHoldings('members.spaces')}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function SignalsPulseMapWidget({
  signals,
}: {
  signals: ActivityResponse['signals'];
}) {
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const priorities = signals.priorities.length
    ? signals.priorities
    : ['low', 'medium', 'high'];
  const types = signals.types.length ? signals.types : ['Signal'];
  const maxCount = Math.max(1, ...signals.matrix.map((item) => item.count));
  const radius = d3.scaleSqrt().domain([0, maxCount]).range([8, 34]);
  const countByKey = new Map(
    signals.matrix.map((item) => [
      `${item.priority}:::${item.type}`,
      item.count,
    ]),
  );

  const width = Math.max(620, types.length * 170);
  const height = Math.max(420, priorities.length * 120);
  const margin = { top: 50, right: 26, bottom: 24, left: 100 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const x = d3
    .scalePoint<string>()
    .domain(types)
    .range([0, innerWidth])
    .padding(0.5);
  const y = d3
    .scalePoint<string>()
    .domain(priorities)
    .range([0, innerHeight])
    .padding(0.5);

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">
          {tTokenHoldings('signals.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {tTokenHoldings('signals.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-h-[420px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-[360px] w-full">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {priorities.map((priority) => {
              const rowY = y(priority) ?? 0;
              return (
                <g key={priority}>
                  <line
                    x1={0}
                    x2={innerWidth}
                    y1={rowY}
                    y2={rowY}
                    stroke="var(--border)"
                    strokeDasharray="2 8"
                    opacity={0.45}
                  />
                  <text
                    x={-14}
                    y={rowY}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted-foreground text-[14px] font-medium"
                  >
                    {capitalizeWords(priority)}
                  </text>
                </g>
              );
            })}

            {types.map((type) => {
              const colX = x(type) ?? 0;
              return (
                <text
                  key={type}
                  x={colX}
                  y={-18}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[14px] font-medium"
                >
                  {type}
                </text>
              );
            })}

            {priorities.flatMap((priority) =>
              types.map((type) => {
                const cx = x(type) ?? 0;
                const cy = y(priority) ?? 0;
                const count = countByKey.get(`${priority}:::${type}`) ?? 0;
                const r = radius(count);
                return (
                  <g key={`${priority}-${type}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r={Math.max(r + 12, 0)}
                      className={count > 0 ? 'animate-pulse' : ''}
                      fill="var(--space-accent, var(--accent-9))"
                      opacity={count > 0 ? 0.18 : 0}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r={Math.max(r, 5)}
                      fill={
                        count > 0
                          ? 'var(--space-accent, var(--accent-9))'
                          : 'var(--neutral-6)'
                      }
                      opacity={count > 0 ? 0.95 : 0.4}
                    />
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-background text-[16px] font-semibold"
                    >
                      {count > 0 ? count : ''}
                    </text>
                  </g>
                );
              }),
            )}
          </g>
        </svg>
      </CardContent>
    </Card>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <Card key={index}>
          <CardHeader className="gap-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-44 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-[80%]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function HomeTokenHoldingsDashboard({
  spaceSlug,
}: {
  spaceSlug: string;
}) {
  const { getAccessToken } = useAuthentication();
  const locale = useLocale();
  const tModalAside = useTranslations('ModalAside');
  const tCommon = useTranslations('Common');
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const { data, error, isLoading } = useSWR(
    ['space-token-holdings-home', spaceSlug],
    fetchHoldings(spaceSlug, getAccessToken),
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );
  const {
    data: activityData,
    error: activityError,
    isLoading: activityLoading,
  } = useSWR(
    ['space-overview-activity-home', spaceSlug],
    fetchOverviewActivity(spaceSlug, getAccessToken),
    { revalidateOnFocus: true, refreshInterval: 120_000 },
  );

  const [activeFilter, setActiveFilter] =
    React.useState<HomeSectionFilter>('all');

  const getTokenTypeLabel = React.useCallback(
    (type: string) => {
      try {
        const translated = tModalAside(
          `plugins.issueNewToken.general.tokenTypeOptions.${type}.label`,
        );
        return capitalizeWords(translated);
      } catch {
        return prettifyTokenType(type);
      }
    },
    [tModalAside],
  );
  const hasEnergyData = Boolean(activityData?.energy.available);
  const filterItems = React.useMemo(
    () =>
      [
        { value: 'all', label: tTokenHoldings('filters.all') },
        ...(hasEnergyData
          ? [{ value: 'energy', label: tTokenHoldings('filters.energy') }]
          : []),
        { value: 'activity', label: tTokenHoldings('filters.activity') },
        {
          value: 'distribution',
          label: tTokenHoldings('filters.distribution'),
        },
      ] as Array<{ value: HomeSectionFilter; label: string }>,
    [hasEnergyData, tTokenHoldings],
  );
  const showActivity = activeFilter === 'all' || activeFilter === 'activity';
  const showDistribution =
    activeFilter === 'all' || activeFilter === 'distribution';

  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-7 font-semibold tracking-tight text-foreground">
          {tCommon('home')}
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          {tTokenHoldings('subtitle')}
        </p>
      </div>

      <Tabs
        value={activeFilter}
        onValueChange={(value) => setActiveFilter(value as HomeSectionFilter)}
      >
        <TabsList triggerVariant="switch" className="w-fit">
          {filterItems.map((item) => (
            <TabsTrigger key={item.value} value={item.value} variant="switch">
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showActivity ? (
        <>
          {activityLoading ? <LoadingState /> : null}

          {!activityLoading && activityError ? (
            <Card>
              <CardHeader>
                <CardTitle>{tTokenHoldings('activity.title')}</CardTitle>
                <CardDescription>
                  {tTokenHoldings('activity.error')}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!activityLoading && !activityError && activityData ? (
            <div className="grid gap-4 md:grid-cols-2">
              <SignalsPulseMapWidget signals={activityData.signals} />
              <ProposalsPieWidget data={activityData.proposals} />
              <MembersEvolutionWidget
                monthly={activityData.members.monthly}
                locale={locale}
              />
            </div>
          ) : null}
        </>
      ) : null}

      {showDistribution ? (
        <>
          {isLoading ? <LoadingState /> : null}

          {!isLoading && error ? (
            <Card>
              <CardHeader>
                <CardTitle>{tTokenHoldings('error.title')}</CardTitle>
                <CardDescription>
                  {tTokenHoldings('error.description')}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!isLoading && !error && data && data.tokens.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{tTokenHoldings('empty.title')}</CardTitle>
                <CardDescription>
                  {tTokenHoldings('empty.description')}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!isLoading && !error && data && data.tokens.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {data.tokens.map((token) => (
                <Card
                  key={token.token_address}
                  className="group min-h-[500px] border-border/50 bg-card/90 backdrop-blur-sm"
                >
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className="truncate">
                            {token.name}
                          </CardTitle>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                aria-label={tTokenHoldings('tokenDetailsAria', {
                                  tokenName: token.name,
                                })}
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <CircleHelp className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-xs text-xs leading-relaxed"
                            >
                              <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1">
                                <span className="text-muted-foreground">
                                  {tTokenHoldings('tooltip.totalSupply')}
                                </span>
                                <span>
                                  {formatAmount(token.total_supply, locale)}
                                </span>
                                <span className="text-muted-foreground">
                                  {tCommon('Treasury')}
                                </span>
                                <span>
                                  {formatAmount(token.treasury_balance, locale)}
                                </span>
                                <span className="text-muted-foreground">
                                  {tTokenHoldings('tooltip.other')}
                                </span>
                                <span>
                                  {formatAmount(token.other_balance, locale)}
                                </span>
                                <span className="text-muted-foreground">
                                  {tTokenHoldings('tooltip.address')}
                                </span>
                                <span className="max-w-[160px] truncate">
                                  {token.token_address}
                                </span>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <CardDescription className="text-xs uppercase tracking-wide text-muted-foreground/80">
                          {token.symbol}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="outline"
                        className="shrink-0 border-border/60"
                      >
                        {getTokenTypeLabel(token.type)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <TokenDonutChart
                      title={token.symbol}
                      slices={token.holdings}
                      locale={locale}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      {activeFilter === 'energy' ? (
        <Card>
          <CardHeader>
            <CardTitle>{tTokenHoldings('energy.title')}</CardTitle>
            <CardDescription>
              {tTokenHoldings('energy.description')}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
