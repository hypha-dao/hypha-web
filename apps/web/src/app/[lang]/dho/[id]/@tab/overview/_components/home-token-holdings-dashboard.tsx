'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { useAuthentication } from '@hypha-platform/authentication';
import { useTranslations } from 'next-intl';
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
  hover_key: string;
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
    tags: string[];
    items: Array<{
      id: number;
      priority: string;
      type: string;
      tags: string[];
      created_at: string;
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

type DistributionHistoryResponse = {
  found: boolean;
  space_slug: string;
  asOf: string;
  window_days: number;
  token: {
    token_address: string;
    symbol: string;
    name: string;
    type: string;
  } | null;
  members: Array<{
    id: string;
    label: string;
  }>;
  points: Array<{
    date: string;
    cumulative_amount: number;
    share_pct: number;
  }>;
};

type HomeSectionFilter = 'energy' | 'activity' | 'distribution';

const PERCENTAGE_FORMATTER = d3.format('.1f');
const NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});
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
const PROPOSALS_COLOR_RANGE = [
  'var(--space-accent, var(--accent-9))',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 74%, white 26%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 72%, black 28%)',
];
const MEMBERS_COLOR_RANGE = {
  people: 'var(--space-accent, var(--accent-9))',
  spaces:
    'color-mix(in oklab, var(--space-accent, var(--accent-9)) 64%, white 36%)',
};

function toNumericValue(raw: string): number {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function formatAmount(raw: string): string {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return raw;
  return NUMBER_FORMATTER.format(parsed);
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

function isLikelyI18nKey(value: string): boolean {
  return (
    value.includes('.') &&
    /^[A-Za-z][A-Za-z0-9_.-]*$/.test(value) &&
    !value.includes(' ')
  );
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
      `/api/v1/spaces/${slug}/token-holdings?include_treasury=true&collapse_below_pct=1`,
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

function fetchDistributionHistory(
  slug: string,
  tokenAddress: string,
  memberId: string,
  getAccessToken: (() => Promise<string | null>) | undefined,
) {
  return async (): Promise<DistributionHistoryResponse> => {
    const token = await getAccessToken?.();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const params = new URLSearchParams({
      token_address: tokenAddress,
      member: memberId,
    });
    const response = await fetch(
      `/api/v1/spaces/${slug}/token-distribution-history?${params.toString()}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(
        `Failed to load token distribution history (${response.status})`,
      );
    }
    return (await response.json()) as DistributionHistoryResponse;
  };
}

function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map((part) => Number(part));
  if (!year || !month) return monthKey;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    year: '2-digit',
  }).format(date);
}

function TokenDonutChart({
  title,
  slices,
}: {
  title: string;
  slices: TokenHoldingResponse['tokens'][number]['holdings'];
}) {
  const [hoveredSliceKey, setHoveredSliceKey] = React.useState<string | null>(
    null,
  );
  const chartData = React.useMemo(
    () =>
      slices
        .map((slice, index) => ({
          ...slice,
          hover_key: `${slice.display_name}-${
            slice.address ?? slice.slug ?? index
          }`,
          numeric: toNumericValue(slice.balance),
        }))
        .filter((slice) => slice.numeric > 0),
    [slices],
  );

  const pieData = React.useMemo(
    () =>
      d3
        .pie<ChartSlice>()
        .value((item: ChartSlice) => item.numeric)(chartData),
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
  const hasHoveredSlice = hoveredSliceKey !== null;
  const centerLabel =
    chartData.find((slice) => slice.hover_key === hoveredSliceKey)
      ?.display_name ?? title;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex w-full items-center justify-center lg:w-auto lg:flex-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-52 w-52 rounded-full opacity-90 blur-3xl sm:h-60 sm:w-60 lg:h-64 lg:w-64"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--space-accent, var(--accent-9)) 40%, transparent) 0%, transparent 72%)',
          }}
        />
        <svg
          viewBox="-145 -145 290 290"
          role="img"
          aria-label={`Token distribution chart for ${title}`}
          className="h-auto w-full max-w-[260px] transition-transform duration-300 ease-out group-hover:scale-[1.03] sm:max-w-[300px] lg:max-w-[320px]"
        >
          {pieData.map((segment: d3.PieArcDatum<ChartSlice>) => (
            <path
              key={`${segment.data.display_name}-${segment.index}`}
              d={arcGenerator(segment) ?? ''}
              fill={colorScale(segment.data.display_name)}
              stroke="var(--background)"
              strokeWidth={hoveredSliceKey === segment.data.hover_key ? 2 : 1}
              opacity={
                !hasHoveredSlice || hoveredSliceKey === segment.data.hover_key
                  ? 1
                  : 0.3
              }
              className="cursor-pointer transition-opacity duration-150"
              onMouseEnter={() => setHoveredSliceKey(segment.data.hover_key)}
              onMouseLeave={() => setHoveredSliceKey(null)}
            >
              <title>{`${segment.data.display_name} — ${PERCENTAGE_FORMATTER(
                segment.data.share_pct,
              )}%`}</title>
            </path>
          ))}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-foreground text-[15px] font-semibold"
          >
            {centerLabel}
          </text>
        </svg>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {chartData.map((slice) => (
          <div
            key={`${slice.display_name}-${slice.address ?? 'other'}`}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-0.5 transition-colors duration-150"
            style={{
              background:
                hoveredSliceKey === slice.hover_key
                  ? 'color-mix(in oklab, var(--space-accent, var(--accent-9)) 14%, transparent)'
                  : 'transparent',
              opacity:
                !hasHoveredSlice || hoveredSliceKey === slice.hover_key
                  ? 1
                  : 0.45,
            }}
            onMouseEnter={() => setHoveredSliceKey(slice.hover_key)}
            onMouseLeave={() => setHoveredSliceKey(null)}
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
              {PERCENTAGE_FORMATTER(slice.share_pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DistributionOverTimeChart({
  spaceSlug,
  tokens,
  getAccessToken,
}: {
  spaceSlug: string;
  tokens: TokenHoldingResponse['tokens'];
  getAccessToken: (() => Promise<string | null>) | undefined;
}) {
  const tokenOptions = React.useMemo(
    () =>
      tokens.map((token) => ({
        id: token.token_address,
        label: `${token.symbol} · ${token.name}`,
        type: token.type.toLowerCase(),
      })),
    [tokens],
  );

  const [selectedToken, setSelectedToken] = React.useState<string>('');
  const [selectedMember, setSelectedMember] = React.useState<string>('all');

  React.useEffect(() => {
    if (!tokenOptions.length) {
      setSelectedToken('');
      return;
    }
    setSelectedToken((current) => {
      if (current && tokenOptions.some((option) => option.id === current)) {
        return current;
      }
      return (
        tokenOptions.find((option) => option.type.includes('utility'))?.id ??
        tokenOptions[0]!.id
      );
    });
  }, [tokenOptions]);

  const {
    data: history,
    error: historyError,
    isLoading: historyLoading,
  } = useSWR(
    selectedToken
      ? [
          'space-token-distribution-history',
          spaceSlug,
          selectedToken,
          selectedMember,
        ]
      : null,
    ([, slug, tokenAddress, memberId]) =>
      fetchDistributionHistory(slug, tokenAddress, memberId, getAccessToken)(),
    { revalidateOnFocus: true, refreshInterval: 120_000 },
  );

  React.useEffect(() => {
    if (!history?.members?.length) return;
    setSelectedMember((current) =>
      history.members.some((member) => member.id === current) ? current : 'all',
    );
  }, [history?.members]);

  const chartPoints = React.useMemo(
    () =>
      (history?.points ?? [])
        .map((point) => ({
          ...point,
          dateObj: new Date(point.date),
        }))
        .filter((point) => !Number.isNaN(point.dateObj.getTime())),
    [history?.points],
  );

  const width = Math.max(640, chartPoints.length * 18);
  const height = 340;
  const margin = { top: 22, right: 22, bottom: 52, left: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const orderedPoints = React.useMemo(
    () =>
      [...chartPoints].sort(
        (a, b) => a.dateObj.getTime() - b.dateObj.getTime(),
      ),
    [chartPoints],
  );
  const xDomain = d3.extent(chartPoints, (point) => point.dateObj);
  const x = d3
    .scaleTime()
    .domain(
      xDomain[0] && xDomain[1]
        ? [xDomain[0], xDomain[1]]
        : [new Date(Date.now() - 86_400_000), new Date()],
    )
    .range([0, innerWidth]);
  const maxY = Math.max(1, ...orderedPoints.map((point) => point.share_pct));
  const minY = Math.min(...orderedPoints.map((point) => point.share_pct));
  const spread = Math.max(1, maxY - minY);
  const y = d3
    .scaleLinear()
    .domain([Math.max(0, minY - spread * 0.18), maxY + spread * 0.28])
    .nice()
    .range([innerHeight, 0]);
  const area = d3
    .area<(typeof orderedPoints)[number]>()
    .x((point) => x(point.dateObj))
    .y0(innerHeight)
    .y1((point) => y(point.share_pct))
    .curve(d3.curveStepAfter);
  const line = d3
    .line<(typeof orderedPoints)[number]>()
    .x((point) => x(point.dateObj))
    .y((point) => y(point.share_pct))
    .curve(d3.curveStepAfter);
  const gradientId = React.useId().replace(/:/g, '');
  const memberOptions = history?.members ?? [{ id: 'all', label: 'All' }];
  const lastPoint = orderedPoints.at(-1);
  const firstPoint = orderedPoints[0];
  const netChange =
    firstPoint && lastPoint ? lastPoint.share_pct - firstPoint.share_pct : 0;
  const netChangeSign = netChange >= 0 ? '+' : '';

  return (
    <Card className="h-fit self-start overflow-hidden border-border/60 bg-card/95 shadow-[0_0_0_1px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_12%,transparent),0_22px_48px_-30px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_48%,transparent)]">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <CardTitle className="text-lg">Distribution over time</CardTitle>
            <CardDescription className="text-xs">
              X axis shows time from transaction dates.
            </CardDescription>
          </div>
          <div className="flex w-full flex-row items-end justify-end gap-2 md:w-auto">
            <label className="flex w-[160px] max-w-[160px] flex-col gap-1 text-xs text-muted-foreground">
              Token
              <select
                value={selectedToken}
                onChange={(event) => setSelectedToken(event.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {tokenOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex w-[140px] max-w-[140px] flex-col gap-1 text-xs text-muted-foreground">
              Member
              <select
                value={selectedMember}
                onChange={(event) => setSelectedMember(event.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {memberOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">
            Start{' '}
            {firstPoint
              ? `${PERCENTAGE_FORMATTER(firstPoint.share_pct)}%`
              : '0%'}
          </span>
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">
            End{' '}
            {lastPoint ? `${PERCENTAGE_FORMATTER(lastPoint.share_pct)}%` : '0%'}
          </span>
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-foreground">
            Delta {netChangeSign}
            {PERCENTAGE_FORMATTER(netChange)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {historyLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : historyError ? (
          <p className="text-sm text-muted-foreground">
            Unable to load token distribution history right now.
          </p>
        ) : chartPoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No transfer history found for the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="h-[320px] min-w-[620px] w-full"
            >
              <defs>
                <linearGradient
                  id={`distribution-over-time-${gradientId}`}
                  x1="0%"
                  x2="0%"
                  y1="100%"
                  y2="0%"
                >
                  <stop
                    offset="0%"
                    stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 20%, transparent)"
                  />
                  <stop
                    offset="100%"
                    stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 74%, white 26%)"
                  />
                </linearGradient>
                <filter
                  id={`distribution-line-glow-${gradientId}`}
                  x="-30%"
                  y="-30%"
                  width="160%"
                  height="180%"
                >
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feColorMatrix
                    in="blur"
                    type="matrix"
                    values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.75 0"
                    result="glow"
                  />
                  <feMerge>
                    <feMergeNode in="glow" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <radialGradient
                  id={`distribution-ambient-${gradientId}`}
                  cx="56%"
                  cy="38%"
                  r="62%"
                >
                  <stop
                    offset="0%"
                    stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 42%, transparent)"
                    stopOpacity="0.34"
                  />
                  <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </radialGradient>
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                <rect
                  x={0}
                  y={0}
                  width={innerWidth}
                  height={innerHeight}
                  fill={`url(#distribution-ambient-${gradientId})`}
                  opacity={0.7}
                />
                {y.ticks(4).map((tick) => (
                  <g key={tick} transform={`translate(0,${y(tick)})`}>
                    <line
                      x1={0}
                      x2={innerWidth}
                      stroke="var(--border)"
                      strokeDasharray="3 5"
                      opacity={0.75}
                    />
                    <text
                      x={-8}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {PERCENTAGE_FORMATTER(tick)}%
                    </text>
                  </g>
                ))}

                <path
                  d={area(orderedPoints) ?? ''}
                  fill={`url(#distribution-over-time-${gradientId})`}
                  opacity={0.9}
                />
                <path
                  d={line(orderedPoints) ?? ''}
                  fill="none"
                  stroke="var(--space-accent, var(--accent-9))"
                  strokeWidth={3}
                  filter={`url(#distribution-line-glow-${gradientId})`}
                />

                {orderedPoints
                  .filter(
                    (_, index) =>
                      index %
                        Math.max(1, Math.floor(orderedPoints.length / 12)) ===
                      0,
                  )
                  .map((point) => (
                    <circle
                      key={point.date}
                      cx={x(point.dateObj)}
                      cy={y(point.share_pct)}
                      r={3.5}
                      fill="var(--space-accent, var(--accent-9))"
                      className="opacity-95"
                    />
                  ))}

                {lastPoint ? (
                  <g>
                    <circle
                      cx={x(lastPoint.dateObj)}
                      cy={y(lastPoint.share_pct)}
                      r={8}
                      fill="var(--space-accent, var(--accent-9))"
                      opacity={0.24}
                    />
                    <circle
                      cx={x(lastPoint.dateObj)}
                      cy={y(lastPoint.share_pct)}
                      r={4.2}
                      fill="var(--space-accent, var(--accent-9))"
                    />
                    <text
                      x={Math.min(innerWidth - 8, x(lastPoint.dateObj) + 10)}
                      y={y(lastPoint.share_pct) - 10}
                      textAnchor="start"
                      className="fill-foreground text-[11px] font-semibold"
                    >
                      {PERCENTAGE_FORMATTER(lastPoint.share_pct)}%
                    </text>
                  </g>
                ) : null}

                {x.ticks(6).map((tick) => (
                  <g
                    key={tick.toISOString()}
                    transform={`translate(${x(tick)},0)`}
                  >
                    <line
                      y1={innerHeight}
                      y2={innerHeight + 5}
                      stroke="var(--border)"
                    />
                    <text
                      y={innerHeight + 18}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {d3.timeFormat('%b %d')(tick)}
                    </text>
                  </g>
                ))}

                <text
                  x={innerWidth / 2}
                  y={innerHeight + 40}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  Time
                </text>
              </g>
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProposalsPieWidget({ data }: { data: ActivityResponse['proposals'] }) {
  const pieData = React.useMemo(
    () => [
      {
        label: 'On voting',
        value: data.onVoting,
        color: PROPOSALS_COLOR_RANGE[0],
      },
      {
        label: 'Accepted',
        value: data.accepted,
        color: PROPOSALS_COLOR_RANGE[1],
      },
      {
        label: 'Refused',
        value: data.refused,
        color: PROPOSALS_COLOR_RANGE[2],
      },
    ],
    [data.accepted, data.onVoting, data.refused],
  );

  const total = pieData.reduce((sum, item) => sum + item.value, 0);
  const chartInput =
    total > 0
      ? pieData
      : [{ label: 'No data', value: 1, color: 'var(--neutral-6)' }];
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
        <CardTitle className="text-lg">Proposals</CardTitle>
        <CardDescription className="text-xs">
          On voting, accepted, refused
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-h-[320px] grid-cols-1 items-center gap-3 lg:min-h-[420px] lg:grid-cols-[1fr_auto]">
        <svg
          viewBox="-130 -130 260 260"
          className="h-[240px] w-full sm:h-[280px] lg:h-[340px]"
          aria-label="Proposals distribution"
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

        <div className="flex min-w-0 flex-col gap-3 text-sm lg:min-w-[180px] lg:pr-2">
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
}: {
  monthly: ActivityResponse['members']['monthly'];
}) {
  const maxValue = React.useMemo(
    () =>
      Math.max(1, ...monthly.map((item) => Math.max(item.people, item.spaces))),
    [monthly],
  );
  const totals = React.useMemo(() => {
    const last = monthly.at(-1);
    const first = monthly[0];
    return {
      people: Math.round(last?.people ?? 0),
      spaces: Math.round(last?.spaces ?? 0),
      deltaPeople: Math.round((last?.people ?? 0) - (first?.people ?? 0)),
      deltaSpaces: Math.round((last?.spaces ?? 0) - (first?.spaces ?? 0)),
    };
  }, [monthly]);

  const width = 760;
  const height = 340;
  const margin = { top: 18, right: 22, bottom: 56, left: 44 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const x = d3
    .scalePoint<string>()
    .domain(monthly.map((item) => item.month))
    .range([0, innerWidth])
    .padding(0.5);
  const y = d3.scaleSqrt().domain([0, maxValue]).range([innerHeight, 0]).nice();
  const memberAxisTicks = React.useMemo(() => {
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

  const linePeople = d3
    .line<(typeof monthly)[number]>()
    .x((item) => x(item.month) ?? 0)
    .y((item) => y(item.people))
    .curve(d3.curveMonotoneX);
  const lineSpaces = d3
    .line<(typeof monthly)[number]>()
    .x((item) => x(item.month) ?? 0)
    .y((item) => y(item.spaces))
    .curve(d3.curveMonotoneX);
  const gradientId = React.useId().replace(/:/g, '');

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">Members</CardTitle>
        <CardDescription className="text-xs">
          Cumulative monthly members and spaces (net of exits)
        </CardDescription>
        <div className="flex items-center gap-2 pt-1 text-[11px]">
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">
            People {totals.people} ({totals.deltaPeople >= 0 ? '+' : ''}
            {totals.deltaPeople})
          </span>
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">
            Spaces {totals.spaces} ({totals.deltaSpaces >= 0 ? '+' : ''}
            {totals.deltaSpaces})
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="min-w-[620px] w-full"
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              {memberAxisTicks.map((tick) => (
                <g key={tick} transform={`translate(0,${y(tick)})`}>
                  <line
                    x1={0}
                    x2={innerWidth}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                    opacity={0.7}
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

              <defs>
                <linearGradient
                  id={`members-people-${gradientId}`}
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="0%"
                >
                  <stop
                    offset="0%"
                    stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 78%, white 22%)"
                  />
                  <stop offset="100%" stopColor={MEMBERS_COLOR_RANGE.people} />
                </linearGradient>
                <linearGradient
                  id={`members-spaces-${gradientId}`}
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="0%"
                >
                  <stop
                    offset="0%"
                    stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 65%, white 35%)"
                  />
                  <stop offset="100%" stopColor={MEMBERS_COLOR_RANGE.spaces} />
                </linearGradient>
              </defs>

              <path
                d={linePeople(monthly) ?? ''}
                fill="none"
                stroke={`url(#members-people-${gradientId})`}
                strokeWidth={3}
              />
              <path
                d={lineSpaces(monthly) ?? ''}
                fill="none"
                stroke={`url(#members-spaces-${gradientId})`}
                strokeWidth={2.5}
                strokeDasharray="5 4"
                opacity={0.9}
              />

              {monthly.map((item) => {
                const monthX = x(item.month) ?? 0;
                const peopleY = y(item.people);
                const spacesY = y(item.spaces);
                const hasActivity = item.people > 0 || item.spaces > 0;
                return (
                  <g key={item.month}>
                    {hasActivity ? (
                      <rect
                        x={monthX - 12}
                        y={0}
                        width={24}
                        height={innerHeight}
                        rx={8}
                        fill="color-mix(in oklab, var(--space-accent, var(--accent-9)) 10%, transparent)"
                        opacity={0.5}
                      />
                    ) : null}
                    <circle
                      cx={monthX}
                      cy={peopleY}
                      r={item.people > 0 ? 4 : 2}
                      fill={MEMBERS_COLOR_RANGE.people}
                    />
                    <circle
                      cx={monthX}
                      cy={spacesY}
                      r={item.spaces > 0 ? 3.5 : 1.8}
                      fill={MEMBERS_COLOR_RANGE.spaces}
                    />
                    <text
                      x={monthX}
                      y={innerHeight + 20}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {formatMonthLabel(item.month)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="flex items-center gap-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: MEMBERS_COLOR_RANGE.people }}
            />
            Members
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: MEMBERS_COLOR_RANGE.spaces }}
            />
            Spaces
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
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [hoveredSignalId, setHoveredSignalId] = React.useState<number | null>(
    null,
  );
  const priorityRank = React.useMemo(
    () =>
      new Map(
        ['critical', 'high', 'medium', 'low'].map((key, index) => [key, index]),
      ),
    [],
  );
  const priorities = React.useMemo(() => {
    const source = signals.priorities.length
      ? signals.priorities
      : ['critical', 'high', 'medium', 'low'];
    return [...source].sort((a, b) => {
      const aRank =
        priorityRank.get(a.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      const bRank =
        priorityRank.get(b.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      return a.localeCompare(b);
    });
  }, [priorityRank, signals.priorities]);
  const prioritySize = React.useMemo(
    () => ({
      critical: 28,
      high: 24,
      medium: 20,
      low: 16,
      default: 18,
    }),
    [],
  );
  const filteredSignals = React.useMemo(() => {
    if (!selectedTags.length) return signals.items;
    return signals.items.filter((item) =>
      selectedTags.every((tag) => item.tags.includes(tag)),
    );
  }, [selectedTags, signals.items]);
  const sortedSignals = React.useMemo(
    () =>
      [...filteredSignals].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [filteredSignals],
  );
  const dates = sortedSignals
    .map((item) => new Date(item.created_at))
    .filter((value) => !Number.isNaN(value.getTime()));
  const recentDate = dates.length
    ? new Date(Math.max(...dates.map(Number)))
    : null;
  const oldestDate = dates.length
    ? new Date(Math.min(...dates.map(Number)))
    : null;

  const width = Math.max(720, sortedSignals.length * 84);
  const height = 420;
  const margin = { top: 54, right: 28, bottom: 34, left: 92 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const shouldSpreadRecencySlots = React.useMemo(() => {
    if (!sortedSignals.length) return false;
    if (sortedSignals.length <= 4) return true;
    if (!recentDate || !oldestDate) return true;
    return recentDate.getTime() === oldestDate.getTime();
  }, [oldestDate, recentDate, sortedSignals.length]);
  const x = d3
    .scaleTime()
    .domain(
      recentDate && oldestDate
        ? [recentDate, oldestDate]
        : [new Date(Date.now() + 3_600_000), new Date()],
    )
    .range([0, innerWidth])
    .nice();
  const xByRecencySlot = React.useMemo(
    () =>
      d3
        .scalePoint<number>()
        .domain(sortedSignals.map((_, index) => index))
        .range([24, innerWidth - 24])
        .padding(0.65),
    [innerWidth, sortedSignals],
  );
  const y = d3
    .scalePoint<string>()
    .domain(priorities)
    .range([0, innerHeight])
    .padding(0.38);

  return (
    <Card className="border-border/60 bg-card/95 shadow-[0_0_0_1px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_10%,transparent),0_16px_38px_-26px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_42%,transparent)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Signals</CardTitle>
        <CardDescription className="text-xs">
          Priority on Y, recency on X (recent left, older right)
        </CardDescription>
        {signals.tags.length ? (
          <div className="flex flex-wrap gap-2">
            {signals.tags.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setSelectedTags((current) =>
                      selected
                        ? current.filter((item) => item !== tag)
                        : [...current, tag],
                    )
                  }
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-foreground/85 transition hover:border-foreground/30"
                  style={{
                    background: selected
                      ? 'color-mix(in oklab, var(--space-accent, var(--accent-9)) 20%, transparent)'
                      : 'transparent',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="min-h-[420px]">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[360px] min-w-[720px] w-full sm:h-[400px]"
          >
            <defs>
              <filter
                id="signal-depth-shadow"
                x="-40%"
                y="-40%"
                width="180%"
                height="180%"
              >
                <feDropShadow
                  dx="0"
                  dy="7"
                  stdDeviation="7"
                  floodColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 52%, black 48%)"
                  floodOpacity="0.26"
                />
              </filter>
            </defs>
            <g transform={`translate(${margin.left},${margin.top})`}>
              {priorities.map((priority) => {
                const rowY = y(priority) ?? 0;
                return (
                  <g key={priority}>
                    <line
                      x1={0}
                      y1={rowY}
                      x2={innerWidth}
                      y2={rowY}
                      stroke="var(--border)"
                      strokeDasharray="3 5"
                      opacity={0.45}
                    />
                    <text
                      x={-10}
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

              {sortedSignals.map((signal, index) => {
                const createdAt = new Date(signal.created_at);
                if (Number.isNaN(createdAt.getTime())) return null;
                const cx = shouldSpreadRecencySlots
                  ? xByRecencySlot(index) ?? x(createdAt)
                  : x(createdAt);
                const cy = y(signal.priority) ?? 0;
                const radius =
                  prioritySize[
                    signal.priority.toLowerCase() as keyof typeof prioritySize
                  ] ?? prioritySize.default;
                const jitter = (index % 3) * 6 - 6;
                const bubbleLabel = signal.type.slice(0, 1).toUpperCase();
                const isHovered = hoveredSignalId === signal.id;
                const hasHovered = hoveredSignalId !== null;
                return (
                  <g
                    key={signal.id}
                    onMouseEnter={() => setHoveredSignalId(signal.id)}
                    onMouseLeave={() => setHoveredSignalId(null)}
                    style={{
                      opacity: !hasHovered || isHovered ? 1 : 0.38,
                      transition: 'opacity 150ms ease',
                    }}
                  >
                    <circle
                      cx={cx}
                      cy={cy + jitter}
                      r={radius + (isHovered ? 9 : 6)}
                      fill="var(--space-accent, var(--accent-9))"
                      opacity={isHovered ? 0.28 : 0.18}
                    />
                    <circle
                      cx={cx}
                      cy={cy + jitter}
                      r={radius}
                      fill="var(--space-accent, var(--accent-9))"
                      filter="url(#signal-depth-shadow)"
                      opacity={0.92}
                    />
                    <text
                      x={cx}
                      y={cy + jitter}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-background text-[16px] font-semibold"
                    >
                      {bubbleLabel}
                    </text>
                    <title>
                      {`${signal.type} · ${capitalizeWords(
                        signal.priority,
                      )} · ${d3.timeFormat('%b %d, %Y')(createdAt)}${
                        signal.tags.length ? ` · ${signal.tags.join(', ')}` : ''
                      }`}
                    </title>
                  </g>
                );
              })}

              <g
                transform={`translate(${innerWidth - 168}, ${
                  innerHeight + 16
                })`}
              >
                <text className="fill-muted-foreground text-[11px]">
                  Recent
                </text>
                <text x={122} className="fill-muted-foreground text-[11px]">
                  Older
                </text>
              </g>
            </g>
          </svg>
        </div>
        {hoveredSignalId ? (
          <p className="pt-2 text-xs text-muted-foreground">
            {sortedSignals.find((item) => item.id === hoveredSignalId)?.type}{' '}
            signal
          </p>
        ) : null}
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
  const tModalAside = useTranslations('ModalAside');
  const tCommon = useTranslations('Common');
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
    React.useState<HomeSectionFilter>('activity');

  const getTokenTypeLabel = React.useCallback(
    (type: string) => {
      const translationKey = `plugins.issueNewToken.general.tokenTypeOptions.${type}.label`;
      try {
        const translated = tModalAside(translationKey);
        if (isLikelyI18nKey(translated)) {
          return prettifyTokenType(type);
        }
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
        ...(hasEnergyData ? [{ value: 'energy', label: 'Energy' }] : []),
        { value: 'activity', label: 'Activity' },
        { value: 'distribution', label: 'Distribution' },
      ] as Array<{ value: HomeSectionFilter; label: string }>,
    [hasEnergyData],
  );
  const showActivity = activeFilter === 'activity';
  const showDistribution = activeFilter === 'distribution';

  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-7 font-semibold tracking-tight text-foreground">
          {tCommon('home')}
        </h1>
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
                <CardTitle>Unable to load activity widgets</CardTitle>
                <CardDescription>
                  Please retry in a moment. Activity analytics data may still be
                  syncing.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!activityLoading && !activityError && activityData ? (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <div className="grid items-start gap-4">
                <SignalsPulseMapWidget signals={activityData.signals} />
                <MembersEvolutionWidget
                  monthly={activityData.members.monthly}
                />
              </div>
              <div className="grid items-start gap-4">
                <ProposalsPieWidget data={activityData.proposals} />
              </div>
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
                <CardTitle>Unable to load token holdings</CardTitle>
                <CardDescription>
                  Please retry in a moment. If this persists, check your space
                  access and network connectivity.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!isLoading && !error && data && data.tokens.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>No token holdings available yet</CardTitle>
                <CardDescription>
                  This space does not currently expose minted token distribution
                  data.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!isLoading && !error && data && data.tokens.length > 0 ? (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <DistributionOverTimeChart
                spaceSlug={spaceSlug}
                tokens={data.tokens}
                getAccessToken={getAccessToken}
              />
              <div className="grid items-start gap-4">
                {data.tokens.map((token) => (
                  <Card
                    key={token.token_address}
                    className="group border-border/50 bg-card/90 backdrop-blur-sm"
                  >
                    <CardContent className="pt-5">
                      <TokenDonutChart
                        title={token.symbol}
                        slices={token.holdings}
                      />
                    </CardContent>
                    <CardHeader className="gap-3 pt-0">
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
                                  aria-label={`Token details for ${token.name}`}
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
                                    Total supply
                                  </span>
                                  <span>
                                    {formatAmount(token.total_supply)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    {tCommon('Treasury')}
                                  </span>
                                  <span>
                                    {formatAmount(token.treasury_balance)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Other
                                  </span>
                                  <span>
                                    {formatAmount(token.other_balance)}
                                  </span>
                                  <span className="text-muted-foreground">
                                    Address
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
                  </Card>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {activeFilter === 'energy' ? (
        <Card>
          <CardHeader>
            <CardTitle>Energy</CardTitle>
            <CardDescription>
              Energy widgets will appear once energy data is available.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
    </div>
  );
}
