'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { z } from 'zod';
import { useAccessTokenReady } from '@hypha-platform/authentication';
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

const tokenHoldingSuccessSchema = z.object({
  found: z.boolean(),
  space_slug: z.string(),
  asOf: z.string(),
  tokens: z.array(
    z.object({
      token_id: z.number().nullable(),
      token_address: z.string(),
      name: z.string(),
      symbol: z.string(),
      icon_url: z.string().nullable(),
      type: z.string(),
      decimals: z.number(),
      max_supply: z.union([z.string(), z.number()]).nullable(),
      total_supply: z.string(),
      holdings: z.array(
        z.object({
          holder_kind: z.enum(['person', 'space', 'treasury', 'other']),
          address: z.string().nullable(),
          display_name: z.string(),
          slug: z.string().nullable(),
          balance: z.string(),
          balance_raw: z.string(),
          share_pct: z.number().min(0).max(100),
        }),
      ),
      treasury_balance: z.string(),
      other_balance: z.string(),
      total_holders_balance: z.string(),
    }),
  ),
});

const tokenHoldingErrorEnvelopeSchema = z.object({
  isError: z.literal(true),
  found: z.boolean().optional(),
  space_slug: z.string().optional(),
  reason: z.string().optional(),
  error_code: z
    .enum(['access_denied', 'not_found', 'invalid_input', 'server_error'])
    .optional(),
});

const tokenHoldingRouteErrorSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});

type TokenHoldingResponse = z.infer<typeof tokenHoldingSuccessSchema>;

class TokenHoldingsFetchError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TokenHoldingsFetchError';
  }
}

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
/** Stepped space-accent scale — distinct slices without rainbow mixes. */
const COLOR_RANGE = [
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 55%, white 45%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 72%, white 28%)',
  'var(--space-accent, var(--accent-9))',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 82%, black 18%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 68%, black 32%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 54%, black 46%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 42%, var(--neutral-9) 58%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 28%, var(--neutral-8) 72%)',
  'var(--neutral-8)',
  'var(--neutral-7)',
];
const PROPOSALS_COLOR_RANGE = [
  'var(--space-accent, var(--accent-9))',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 48%, white 52%)',
  'color-mix(in oklab, var(--space-accent, var(--accent-9)) 45%, var(--neutral-9) 55%)',
];
const MEMBERS_COLOR_RANGE = {
  people: 'var(--space-accent, var(--accent-9))',
  spaces:
    'color-mix(in oklab, var(--space-accent, var(--accent-9)) 38%, var(--neutral-11) 62%)',
};
const CHART_CARD_CLASS =
  'min-w-0 overflow-hidden rounded-lg border border-border/70 bg-background-2 shadow-none';

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

    // Show more named holders before the long-tail "Other" bucket:
    // keep slices ≥0.5% share, capped at top 10 (+ Other for the rest).
    const response = await fetch(
      `/api/v1/spaces/${slug}/token-holdings?include_treasury=true&collapse_below_pct=0.5&holder_limit=10`,
      { headers },
    );
    const payload = await response.json();
    const parsedErrorEnvelope =
      tokenHoldingErrorEnvelopeSchema.safeParse(payload);
    const parsedRouteError = tokenHoldingRouteErrorSchema.safeParse(payload);

    if (!response.ok) {
      const code =
        parsedErrorEnvelope.success && parsedErrorEnvelope.data.error_code
          ? parsedErrorEnvelope.data.error_code
          : response.status === 401 || response.status === 403
          ? 'access_denied'
          : null;
      const reason =
        (parsedErrorEnvelope.success
          ? parsedErrorEnvelope.data.reason
          : null) ??
        (parsedRouteError.success ? parsedRouteError.data.message : null) ??
        (parsedRouteError.success ? parsedRouteError.data.error : null) ??
        `Failed to load token holdings (${response.status})`;
      throw new TokenHoldingsFetchError(reason, code, response.status);
    }

    if (parsedErrorEnvelope.success) {
      throw new TokenHoldingsFetchError(
        parsedErrorEnvelope.data.reason ?? 'Failed to load token holdings',
        parsedErrorEnvelope.data.error_code ?? null,
        response.status,
      );
    }

    const parsed = tokenHoldingSuccessSchema.safeParse(payload);
    if (!parsed.success) {
      throw new Error('Token holdings response shape is invalid');
    }
    return parsed.data;
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
}: {
  title: string;
  slices: TokenHoldingResponse['tokens'][number]['holdings'];
}) {
  const locale = useLocale();
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
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
        .padAngle(0.018)
        .sort(null)
        .value((item: ChartSlice) => item.numeric)(chartData),
    [chartData],
  );

  const outerRadius = 118;
  const activeOuterRadius = 122;
  const innerRadius = 78;
  const arcGenerator = React.useMemo(
    () =>
      d3
        .arc<d3.PieArcDatum<ChartSlice>>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius)
        .padAngle(0.018),
    [],
  );
  const activeArcGenerator = React.useMemo(
    () =>
      d3
        .arc<d3.PieArcDatum<ChartSlice>>()
        .innerRadius(innerRadius)
        .outerRadius(activeOuterRadius)
        .padAngle(0.018),
    [],
  );

  const colorScale = React.useMemo(() => {
    const domain = chartData.map((slice) => slice.display_name);
    return d3.scaleOrdinal<string, string>().domain(domain).range(COLOR_RANGE);
  }, [chartData]);
  const hasHoveredSlice = hoveredSliceKey !== null;
  const hoveredSlice = chartData.find(
    (slice) => slice.hover_key === hoveredSliceKey,
  );
  const centerPrimary = hoveredSlice?.display_name ?? title;
  const centerSecondary = hoveredSlice
    ? `${PERCENTAGE_FORMATTER(hoveredSlice.share_pct)}%`
    : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="relative flex w-full items-center justify-center">
        <svg
          viewBox="-140 -140 280 280"
          role="img"
          aria-label={tTokenHoldings('chartAria', { title })}
          className="h-auto w-full max-w-[240px] sm:max-w-[280px]"
        >
          {pieData.map((segment: d3.PieArcDatum<ChartSlice>) => {
            const isActive = hoveredSliceKey === segment.data.hover_key;
            return (
              <path
                key={`${segment.data.display_name}-${segment.index}`}
                d={
                  (isActive
                    ? activeArcGenerator(segment)
                    : arcGenerator(segment)) ?? ''
                }
                fill={colorScale(segment.data.display_name)}
                stroke="var(--color-background-2, var(--background))"
                strokeWidth={1.25}
                // Not keyboard-focusable: browser focus rings clip arc paths into
                // a rectangular wedge artifact. Legend buttons handle a11y focus.
                aria-hidden="true"
                opacity={!hasHoveredSlice || isActive ? 1 : 0.28}
                className="cursor-pointer transition-opacity duration-150"
                onMouseEnter={() => setHoveredSliceKey(segment.data.hover_key)}
                onMouseLeave={() => setHoveredSliceKey(null)}
              >
                <title>{`${segment.data.display_name} — ${PERCENTAGE_FORMATTER(
                  segment.data.share_pct,
                )}% (${formatAmount(segment.data.balance, locale)})`}</title>
              </path>
            );
          })}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            y={centerSecondary ? -7 : 0}
            className="fill-foreground text-[13px] font-medium tracking-wide"
          >
            {centerPrimary}
          </text>
          {centerSecondary ? (
            <text
              textAnchor="middle"
              dominantBaseline="middle"
              y={12}
              className="fill-muted-foreground text-[11px] font-normal"
            >
              {centerSecondary}
            </text>
          ) : null}
        </svg>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
        {chartData.map((slice) => (
          <button
            type="button"
            key={`${slice.display_name}-${slice.address ?? 'other'}`}
            className="flex w-full cursor-pointer items-baseline justify-between gap-2 rounded-md border-0 bg-transparent px-1 py-1 text-left transition-colors duration-150 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border"
            style={{
              background:
                hoveredSliceKey === slice.hover_key
                  ? 'color-mix(in oklab, var(--space-accent, var(--accent-9)) 10%, transparent)'
                  : undefined,
              opacity:
                !hasHoveredSlice || hoveredSliceKey === slice.hover_key
                  ? 1
                  : 0.4,
            }}
            onMouseEnter={() => setHoveredSliceKey(slice.hover_key)}
            onMouseLeave={() => setHoveredSliceKey(null)}
            onFocus={() => setHoveredSliceKey(slice.hover_key)}
            onBlur={() => setHoveredSliceKey(null)}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: colorScale(slice.display_name) }}
              />
              <span className="truncate text-2 text-foreground">
                {slice.display_name}
              </span>
            </div>
            <span className="shrink-0 tabular-nums text-1 text-muted-foreground">
              {PERCENTAGE_FORMATTER(slice.share_pct)}%
              <span className="mx-1 text-border">·</span>
              {formatAmount(slice.balance, locale)}
            </span>
          </button>
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

  const width = Math.max(720, chartPoints.length * 24);
  const height = 300;
  const margin = { top: 14, right: 18, bottom: 46, left: 54 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const orderedPoints = React.useMemo(
    () =>
      [...chartPoints].sort(
        (a, b) => a.dateObj.getTime() - b.dateObj.getTime(),
      ),
    [chartPoints],
  );
  const xDomain = d3.extent(orderedPoints, (point) => point.dateObj);
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
  const yPadding = Math.max(0.8, spread * 0.12);
  const minYWithPadding = Math.max(0, minY - yPadding);
  const y = d3
    .scaleLinear()
    .domain([minYWithPadding, maxY + yPadding])
    .nice(5)
    .range([innerHeight, 0]);
  const area = d3
    .area<(typeof orderedPoints)[number]>()
    .x((point) => x(point.dateObj))
    .y0(y(minYWithPadding))
    .y1((point) => y(point.share_pct))
    .curve(d3.curveMonotoneX);
  const line = d3
    .line<(typeof orderedPoints)[number]>()
    .x((point) => x(point.dateObj))
    .y((point) => y(point.share_pct))
    .curve(d3.curveMonotoneX);
  const gradientId = React.useId().replace(/:/g, '');
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const memberOptions = history?.members ?? [
    { id: 'all', label: tTokenHoldings('distribution.memberAll') },
  ];
  const lastPoint = orderedPoints.at(-1);
  const firstPoint = orderedPoints[0];
  const netChange =
    firstPoint && lastPoint ? lastPoint.share_pct - firstPoint.share_pct : 0;
  const netChangeSign = netChange >= 0 ? '+' : '';
  const xTickValues = React.useMemo(() => {
    if (!orderedPoints.length) return [] as Date[];
    if (orderedPoints.length <= 6) {
      return orderedPoints.map((point) => point.dateObj);
    }
    const step = Math.max(1, Math.floor((orderedPoints.length - 1) / 5));
    const ticks = orderedPoints
      .filter((_, index) => index % step === 0)
      .map((point) => point.dateObj);
    const lastDate = orderedPoints.at(-1)?.dateObj;
    if (
      lastDate &&
      !ticks.some((value) => value.getTime() === lastDate.getTime())
    ) {
      ticks.push(lastDate);
    }
    return ticks;
  }, [orderedPoints]);

  return (
    <Card className={`h-fit self-start ${CHART_CARD_CLASS}`}>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-4 font-medium tracking-tight">
              {tTokenHoldings('distribution.title')}
            </CardTitle>
            <CardDescription className="text-1 text-muted-foreground">
              {tTokenHoldings('distribution.subtitle')}
            </CardDescription>
          </div>
          <div className="flex w-full flex-row items-end justify-end gap-2 lg:w-auto">
            <label className="flex w-[160px] max-w-[160px] flex-col gap-1 text-xs text-muted-foreground">
              {tTokenHoldings('distribution.tokenLabel')}
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
              {tTokenHoldings('distribution.memberLabel')}
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
            {tTokenHoldings('distribution.start')}{' '}
            {firstPoint
              ? `${PERCENTAGE_FORMATTER(firstPoint.share_pct)}%`
              : '0%'}
          </span>
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">
            {tTokenHoldings('distribution.end')}{' '}
            {lastPoint ? `${PERCENTAGE_FORMATTER(lastPoint.share_pct)}%` : '0%'}
          </span>
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-foreground">
            {tTokenHoldings('distribution.delta')} {netChangeSign}
            {PERCENTAGE_FORMATTER(netChange)}%
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-1">
        {historyLoading ? (
          <Skeleton className="h-[280px] w-full" />
        ) : historyError ? (
          <p className="text-sm text-muted-foreground">
            {tTokenHoldings('distribution.error')}
          </p>
        ) : chartPoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tTokenHoldings('distribution.empty')}
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
                  y1="0%"
                  y2="100%"
                >
                  <stop
                    offset="0%"
                    stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 24%, transparent)"
                  />
                  <stop
                    offset="100%"
                    stopColor="color-mix(in oklab, var(--space-accent, var(--accent-9)) 8%, transparent)"
                  />
                </linearGradient>
              </defs>
              <g transform={`translate(${margin.left},${margin.top})`}>
                {y.ticks(5).map((tick) => (
                  <g key={tick} transform={`translate(0,${y(tick)})`}>
                    <line
                      x1={0}
                      x2={innerWidth}
                      stroke="var(--border)"
                      strokeDasharray="2 4"
                      opacity={0.55}
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
                  opacity={0.95}
                />
                <path
                  d={line(orderedPoints) ?? ''}
                  fill="none"
                  stroke="var(--space-accent, var(--accent-9))"
                  strokeWidth={1.75}
                  strokeLinecap="round"
                  strokeLinejoin="round"
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
                      r={2.4}
                      fill="var(--color-background-2, var(--background))"
                      stroke="var(--space-accent, var(--accent-9))"
                      strokeWidth={1.25}
                    />
                  ))}

                {lastPoint ? (
                  <text
                    x={Math.min(innerWidth - 8, x(lastPoint.dateObj) + 10)}
                    y={y(lastPoint.share_pct) - 10}
                    textAnchor="start"
                    className="fill-muted-foreground text-[10px] tabular-nums"
                  >
                    {PERCENTAGE_FORMATTER(lastPoint.share_pct)}%
                  </text>
                ) : null}

                {xTickValues.map((tick) => (
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
                  {tTokenHoldings('distribution.timeAxis')}
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
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const pieData = React.useMemo(
    () => [
      {
        label: tTokenHoldings('proposals.onVoting'),
        value: data.onVoting,
        color: PROPOSALS_COLOR_RANGE[0],
      },
      {
        label: tTokenHoldings('proposals.accepted'),
        value: data.accepted,
        color: PROPOSALS_COLOR_RANGE[1],
      },
      {
        label: tTokenHoldings('proposals.refused'),
        value: data.refused,
        color: PROPOSALS_COLOR_RANGE[2],
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
    .value((item) => item.value)
    .sort(null)(chartInput);
  const arc = d3
    .arc<d3.PieArcDatum<(typeof chartInput)[number]>>()
    .innerRadius(72)
    .outerRadius(104)
    .cornerRadius(2)
    .padAngle(0.02);

  return (
    <Card className={CHART_CARD_CLASS}>
      <CardHeader className="pb-2">
        <CardTitle className="text-4 font-medium tracking-tight">
          {tTokenHoldings('proposals.title')}
        </CardTitle>
        <CardDescription className="text-1 text-muted-foreground">
          {tTokenHoldings('proposals.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-5 pb-5 pt-1">
        <svg
          viewBox="-120 -120 240 240"
          className="h-[200px] w-full max-w-[220px] sm:h-[220px]"
          aria-label={tTokenHoldings('proposals.ariaLabel')}
        >
          {arcs.map((slice, index) => (
            <path
              key={`${slice.data.label}-${index}`}
              d={arc(slice) ?? ''}
              fill={slice.data.color}
              stroke="var(--color-background-2, var(--background))"
              strokeWidth={1.25}
            />
          ))}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            y={-4}
            className="fill-foreground text-[26px] font-medium tabular-nums"
          >
            {total}
          </text>
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            y={16}
            className="fill-muted-foreground text-[10px] font-normal tracking-wide"
          >
            {tTokenHoldings('proposals.title')}
          </text>
        </svg>

        <div className="grid w-full max-w-sm grid-cols-3 gap-2 text-1">
          {pieData.map((item) => (
            <div
              key={item.label}
              className="flex min-w-0 flex-col items-center gap-1 text-center"
            >
              <span
                className="h-1.5 w-5 rounded-full"
                style={{ backgroundColor: item.color }}
                aria-hidden
              />
              <span className="truncate text-muted-foreground">
                {item.label}
              </span>
              <span className="tabular-nums text-2 font-medium text-foreground">
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

  return (
    <Card className={CHART_CARD_CLASS}>
      <CardHeader className="pb-2">
        <CardTitle className="text-4 font-medium tracking-tight">
          {tTokenHoldings('members.title')}
        </CardTitle>
        <CardDescription className="text-1 text-muted-foreground">
          {tTokenHoldings('members.subtitle')}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-1 text-muted-foreground">
          <span className="tabular-nums">
            <span className="text-foreground">{totals.people}</span>{' '}
            {tTokenHoldings('members.people')}
            <span className="ms-1 text-muted-foreground/80">
              ({totals.deltaPeople >= 0 ? '+' : ''}
              {totals.deltaPeople})
            </span>
          </span>
          <span className="tabular-nums">
            <span className="text-foreground">{totals.spaces}</span>{' '}
            {tTokenHoldings('members.spaces')}
            <span className="ms-1 text-muted-foreground/80">
              ({totals.deltaSpaces >= 0 ? '+' : ''}
              {totals.deltaSpaces})
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
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
                d={linePeople(monthly) ?? ''}
                fill="none"
                stroke={MEMBERS_COLOR_RANGE.people}
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={lineSpaces(monthly) ?? ''}
                fill="none"
                stroke={MEMBERS_COLOR_RANGE.spaces}
                strokeWidth={1.5}
                strokeDasharray="3.5 3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.9}
              />

              {monthly.map((item) => {
                const monthX = x(item.month) ?? 0;
                const peopleY = y(item.people);
                const spacesY = y(item.spaces);
                return (
                  <g key={item.month}>
                    <circle
                      cx={monthX}
                      cy={peopleY}
                      r={item.people > 0 ? 3 : 1.5}
                      fill="var(--color-background-2, var(--background))"
                      stroke={MEMBERS_COLOR_RANGE.people}
                      strokeWidth={1.5}
                    />
                    <circle
                      cx={monthX}
                      cy={spacesY}
                      r={item.spaces > 0 ? 2.5 : 1.25}
                      fill="var(--color-background-2, var(--background))"
                      stroke={MEMBERS_COLOR_RANGE.spaces}
                      strokeWidth={1.25}
                    />
                    <text
                      x={monthX}
                      y={innerHeight + 20}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {formatMonthLabel(item.month, locale)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="flex items-center gap-4 text-1 text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 rounded-full"
              style={{ background: MEMBERS_COLOR_RANGE.people }}
            />
            {tTokenHoldings('members.people')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-0.5 w-3 rounded-full opacity-80"
              style={{
                background: `repeating-linear-gradient(90deg, ${MEMBERS_COLOR_RANGE.spaces} 0 2px, transparent 2px 4px)`,
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
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
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
  const validSignals = React.useMemo(
    () =>
      filteredSignals
        .map((signal) => ({
          ...signal,
          timestamp: new Date(signal.created_at).getTime(),
          priorityKey: signal.priority.toLowerCase(),
        }))
        .filter((signal) => Number.isFinite(signal.timestamp)),
    [filteredSignals],
  );
  const bucketCount = 6;
  const width = 760;
  const height = 360;
  const margin = { top: 28, right: 16, bottom: 54, left: 96 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const recencyExtent = React.useMemo(
    () => d3.extent(validSignals, (signal) => signal.timestamp),
    [validSignals],
  );
  const recentTs =
    recencyExtent[1] ?? recencyExtent[0] ?? Date.now() + 3_600_000;
  const oldestTs = recencyExtent[0] ?? Date.now();
  const recencySpan = Math.max(1, recentTs - oldestTs);
  const bucketIndexByTimestamp = React.useCallback(
    (timestamp: number): number => {
      const ageRatio = (recentTs - timestamp) / recencySpan;
      return Math.max(
        0,
        Math.min(bucketCount - 1, Math.floor(ageRatio * bucketCount)),
      );
    },
    [recentTs, recencySpan],
  );

  const matrix = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const priority of priorities) {
      for (let bucketIndex = 0; bucketIndex < bucketCount; bucketIndex += 1) {
        counts.set(`${priority}|${bucketIndex}`, 0);
      }
    }

    for (const signal of validSignals) {
      const bucketIndex = bucketIndexByTimestamp(signal.timestamp);
      const key = `${signal.priorityKey}|${bucketIndex}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [bucketCount, bucketIndexByTimestamp, priorities, validSignals]);

  const maxCellCount = React.useMemo(
    () => Math.max(1, ...Array.from(matrix.values())),
    [matrix],
  );
  const cellOpacity = d3
    .scaleLinear()
    .domain([0, maxCellCount])
    .range([0.08, 0.9]);
  const x = d3
    .scaleBand<number>()
    .domain(d3.range(bucketCount))
    .range([0, innerWidth])
    .paddingInner(0.14)
    .paddingOuter(0.02);
  const y = d3
    .scalePoint<string>()
    .domain(priorities)
    .range([0, innerHeight])
    .padding(0.5);
  const yBand = d3
    .scaleBand<string>()
    .domain(priorities)
    .range([0, innerHeight])
    .paddingInner(0.18)
    .paddingOuter(0.08);

  return (
    <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          {tTokenHoldings('signals.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {tTokenHoldings('signals.subtitle')}
        </CardDescription>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1">
            {tTokenHoldings('signals.count')} {validSignals.length}
          </span>
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1">
            {tTokenHoldings('signals.peakCell')} {maxCellCount}
          </span>
        </div>
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
      <CardContent className="min-h-[360px]">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-[320px] min-w-[680px] w-full sm:h-[340px]"
          >
            <g transform={`translate(${margin.left},${margin.top})`}>
              {priorities.map((priority) => {
                const rowY = yBand(priority) ?? 0;
                return (
                  <g key={priority}>
                    <line
                      x1={0}
                      y1={rowY + (yBand.bandwidth() ?? 0)}
                      x2={innerWidth}
                      y2={rowY + (yBand.bandwidth() ?? 0)}
                      stroke="var(--border)"
                      strokeDasharray="2 4"
                      opacity={0.45}
                    />
                    <text
                      x={-10}
                      y={y(priority) ?? rowY}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="fill-muted-foreground text-[13px] font-medium"
                    >
                      {capitalizeWords(priority)}
                    </text>
                  </g>
                );
              })}

              {priorities.flatMap((priority) =>
                d3.range(bucketCount).map((bucketIndex) => {
                  const key = `${priority}|${bucketIndex}`;
                  const count = matrix.get(key) ?? 0;
                  const cellX = x(bucketIndex) ?? 0;
                  const cellY = yBand(priority) ?? 0;
                  const bandwidth = x.bandwidth();
                  const bandheight = yBand.bandwidth();
                  const labelColor =
                    count >= Math.max(2, Math.ceil(maxCellCount * 0.52))
                      ? 'var(--background)'
                      : 'var(--foreground)';
                  const rangeStartPct = Math.round(
                    (bucketIndex / bucketCount) * 100,
                  );
                  const rangeEndPct = Math.round(
                    ((bucketIndex + 1) / bucketCount) * 100,
                  );
                  return (
                    <g key={`${priority}-${bucketIndex}`}>
                      <rect
                        x={cellX}
                        y={cellY}
                        width={bandwidth}
                        height={bandheight}
                        rx={10}
                        fill="var(--space-accent, var(--accent-9))"
                        opacity={cellOpacity(count)}
                        stroke="var(--border)"
                        strokeOpacity={0.32}
                      >
                        <title>
                          {tTokenHoldings('signals.cellTitle', {
                            priority: capitalizeWords(priority),
                            count,
                            start: rangeStartPct,
                            end: rangeEndPct,
                          })}
                        </title>
                      </rect>
                      {count > 0 ? (
                        <text
                          x={cellX + bandwidth / 2}
                          y={cellY + bandheight / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-[13px] font-semibold"
                          fill={labelColor}
                        >
                          {count}
                        </text>
                      ) : null}
                    </g>
                  );
                }),
              )}

              {d3.range(bucketCount).map((bucketIndex) => {
                const cellX = x(bucketIndex) ?? 0;
                const label =
                  bucketIndex === 0
                    ? tTokenHoldings('signals.recent')
                    : bucketIndex === bucketCount - 1
                    ? tTokenHoldings('signals.older')
                    : '';
                return (
                  <g key={`tick-${bucketIndex}`}>
                    <line
                      x1={cellX + x.bandwidth() / 2}
                      y1={innerHeight}
                      x2={cellX + x.bandwidth() / 2}
                      y2={innerHeight + 5}
                      stroke="var(--border)"
                    />
                    <text
                      x={cellX + x.bandwidth() / 2}
                      y={innerHeight + 18}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[11px]"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}

              <text
                x={innerWidth / 2}
                y={innerHeight + 38}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {tTokenHoldings('signals.recency')}
              </text>
            </g>
          </svg>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2 text-[11px] text-muted-foreground">
          <span>{tTokenHoldings('signals.lowActivity')}</span>
          <span className="h-2 w-14 rounded-full bg-[color-mix(in_oklab,var(--space-accent,var(--accent-9))_20%,transparent)]" />
          <span className="h-2 w-14 rounded-full bg-[var(--space-accent,var(--accent-9))]" />
          <span>{tTokenHoldings('signals.highActivity')}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function HomeTokenHoldingsDashboard({
  spaceSlug,
}: {
  spaceSlug: string;
}) {
  const { getAccessToken, isAuthenticated, isAuthLoading, accessTokenReady } =
    useAccessTokenReady();
  const locale = useLocale();
  const tModalAside = useTranslations('ModalAside');
  const tCommon = useTranslations('Common');
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  // Network-gated overview APIs need a Bearer token. Wait for Privy + token
  // and key SWR by auth so we don't cache a premature 401 as a sticky error.
  const authReady = !isAuthLoading && accessTokenReady;
  const authKey = isAuthenticated ? 'auth' : 'anon';
  const { data, error, isLoading } = useSWR(
    authReady ? ['space-token-holdings-home', spaceSlug, authKey] : null,
    fetchHoldings(spaceSlug, getAccessToken),
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );
  const {
    data: activityData,
    error: activityError,
    isLoading: activityLoadingRaw,
  } = useSWR(
    authReady ? ['space-overview-activity-home', spaceSlug, authKey] : null,
    fetchOverviewActivity(spaceSlug, getAccessToken),
    { revalidateOnFocus: true, refreshInterval: 120_000 },
  );
  // SWR reports isLoading=false when the key is null — treat auth wait as loading.
  const activityLoading = !authReady || activityLoadingRaw;
  const holdingsLoading = !authReady || isLoading;

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
  // Temporarily hidden for deployment/testing; re-enable by switching to `hasEnergyData`.
  const showEnergyWidget = false && hasEnergyData;
  const filterItems = React.useMemo(
    () =>
      [
        ...(showEnergyWidget
          ? [{ value: 'energy', label: tTokenHoldings('filters.energy') }]
          : []),
        { value: 'activity', label: tTokenHoldings('filters.activity') },
        {
          value: 'distribution',
          label: tTokenHoldings('filters.distribution'),
        },
      ] as Array<{ value: HomeSectionFilter; label: string }>,
    [showEnergyWidget, tTokenHoldings],
  );
  const showActivity = activeFilter === 'activity';
  const showDistribution = activeFilter === 'distribution';
  // Temporarily hidden for deployment; keep components wired for quick re-enable.
  const showSignalsWidget = false;
  const showDistributionHistoryWidget = false;

  React.useEffect(() => {
    if (activeFilter === 'energy' && !showEnergyWidget) {
      setActiveFilter('activity');
    }
  }, [activeFilter, showEnergyWidget]);

  return (
    <div className="flex flex-col gap-5 py-4">
      <header className="craft-page-header">
        <h1 className="craft-page-title text-6 font-medium">
          {tCommon('home')}
        </h1>
      </header>

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
            <div
              className={
                showSignalsWidget
                  ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]'
                  : 'grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]'
              }
            >
              <div className="grid min-w-0 items-start gap-4">
                {showSignalsWidget ? (
                  <SignalsPulseMapWidget signals={activityData.signals} />
                ) : null}
                <MembersEvolutionWidget
                  monthly={activityData.members.monthly}
                  locale={locale}
                />
              </div>
              <div className="grid min-w-0 items-start gap-4">
                <ProposalsPieWidget data={activityData.proposals} />
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {showDistribution ? (
        <>
          {!holdingsLoading && error ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {error instanceof TokenHoldingsFetchError &&
                  (error.code === 'access_denied' || error.status === 401)
                    ? tTokenHoldings('error.accessDeniedTitle')
                    : tTokenHoldings('error.title')}
                </CardTitle>
                <CardDescription>
                  {error instanceof TokenHoldingsFetchError &&
                  (error.code === 'access_denied' || error.status === 401)
                    ? tTokenHoldings('error.accessDeniedDescription')
                    : tTokenHoldings('error.description')}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!holdingsLoading && !error && data && data.tokens.length === 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>{tTokenHoldings('empty.title')}</CardTitle>
                <CardDescription>
                  {tTokenHoldings('empty.description')}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!holdingsLoading && !error && data && data.tokens.length > 0 ? (
            <div
              className={
                showDistributionHistoryWidget
                  ? 'grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]'
                  : 'grid items-start gap-4'
              }
            >
              {showDistributionHistoryWidget ? (
                <DistributionOverTimeChart
                  spaceSlug={spaceSlug}
                  tokens={data.tokens}
                  getAccessToken={getAccessToken}
                />
              ) : null}
              <div
                className={
                  showDistributionHistoryWidget
                    ? 'grid min-w-0 items-start gap-4'
                    : 'grid min-w-0 items-start gap-4 md:grid-cols-2'
                }
              >
                {data.tokens.map((token) => {
                  const showSymbolSubtitle =
                    token.symbol.trim().toLowerCase() !==
                    token.name.trim().toLowerCase();
                  return (
                    <Card
                      key={token.token_address}
                      className={CHART_CARD_CLASS}
                    >
                      <CardHeader className="gap-2 pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <CardTitle className="truncate text-4 font-medium tracking-tight">
                                {token.name}
                              </CardTitle>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    aria-label={tTokenHoldings(
                                      'tokenDetailsAria',
                                      {
                                        tokenName: token.name,
                                      },
                                    )}
                                    className="inline-flex h-5 w-5 items-center justify-center rounded-chrome text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    <CircleHelp className="h-3.5 w-3.5" />
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
                                      {formatAmount(
                                        token.treasury_balance,
                                        locale,
                                      )}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {tTokenHoldings('tooltip.other')}
                                    </span>
                                    <span>
                                      {formatAmount(
                                        token.other_balance,
                                        locale,
                                      )}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {tTokenHoldings('tooltip.address')}
                                    </span>
                                    <span className="break-all font-mono">
                                      {token.token_address}
                                    </span>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                            {showSymbolSubtitle ? (
                              <CardDescription className="text-1 uppercase tracking-wide text-muted-foreground">
                                {token.symbol}
                              </CardDescription>
                            ) : null}
                          </div>
                          <Badge
                            variant="outline"
                            className="shrink-0 rounded-md border-border/70 px-1.5 py-0.5 text-1 font-normal text-muted-foreground"
                          >
                            {getTokenTypeLabel(token.type)}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <TokenDonutChart
                          title={token.symbol}
                          slices={token.holdings}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {activeFilter === 'energy' && showEnergyWidget ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{tTokenHoldings('energy.title')}</CardTitle>
              <CardDescription>
                {tTokenHoldings('energy.description')}
              </CardDescription>
            </CardHeader>
          </Card>
        </>
      ) : null}
    </div>
  );
}
