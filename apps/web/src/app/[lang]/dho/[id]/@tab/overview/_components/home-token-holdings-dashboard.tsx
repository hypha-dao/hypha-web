'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { z } from 'zod';
import { useAccessTokenReady } from '@hypha-platform/authentication';
import { useLocale, useTranslations } from 'next-intl';
import { CircleHelp } from 'lucide-react';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';
import {
  OverviewFlowsDashboard,
  OverviewMemoryDashboard,
  OverviewSignalsDashboard,
} from './home-overview-metrics';
import { isHyphaPlatformSpace } from '@hypha-platform/core/client';
import {
  ShareStepTimelineChart,
  type ShareTimelinePoint,
} from './home-overview-charts';
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

type HomeSectionFilter =
  | 'energy'
  | 'signals'
  | 'activity'
  | 'memory'
  | 'distribution'
  | 'assets'
  | 'flows';

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

function formatAmount(raw: string, locale: string): string {
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) return raw;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(parsed);
}

const USD_CURRENCY_OPTIONS: Intl.NumberFormatOptions = {
  style: 'currency',
  currency: 'USD',
};

function formatUsdAmount(value: number | string, locale: string): string {
  return formatCurrencyValue(value, locale, USD_CURRENCY_OPTIONS);
}

function prettifyTokenType(type: string | undefined | null): string {
  if (!type) return 'Other';
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
      `/api/v1/spaces/${slug}/token-holdings?include_treasury=true&collapse_below_pct=3`,
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

type SpaceAssetsApiPayload = {
  assets: Array<{
    symbol: string;
    name: string;
    usdEqual: number;
    value?: number;
    tokenPrice?: number;
    type?: string;
  }>;
  balance: number;
};

type SpaceAssetsResponse = {
  assets: Array<{
    symbol: string;
    name: string;
    usdEqual: number;
    value: number;
    tokenPrice: number;
    type: string;
  }>;
  balance: number;
};

function fetchSpaceAssets(
  slug: string,
  getAccessToken: (() => Promise<string | null>) | undefined,
) {
  return async (): Promise<SpaceAssetsResponse> => {
    const token = await getAccessToken?.();
    const headers: HeadersInit = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api/v1/spaces/${slug}/assets`, { headers });
    if (!response.ok) {
      throw new Error(`Failed to load space assets (${response.status})`);
    }
    const payload = (await response.json()) as SpaceAssetsApiPayload;
    return {
      balance:
        typeof payload.balance === 'number' && Number.isFinite(payload.balance)
          ? payload.balance
          : 0,
      assets: Array.isArray(payload.assets)
        ? payload.assets.map((asset) => ({
            symbol: asset.symbol ?? '',
            name: asset.name ?? asset.symbol ?? 'Unknown',
            type: asset.type ?? 'other',
            value: Number(asset.value) || 0,
            tokenPrice: Number(asset.tokenPrice) || 0,
            usdEqual: Number(asset.usdEqual) || 0,
          }))
        : [],
    };
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
  const hasHoveredSlice = hoveredSliceKey !== null;
  const centerLabel =
    chartData.find((slice) => slice.hover_key === hoveredSliceKey)
      ?.display_name ?? title;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex w-full items-center justify-center xl:w-auto xl:flex-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-52 w-52 rounded-full opacity-90 blur-3xl sm:h-60 sm:w-60 xl:h-64 xl:w-64"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--space-accent, var(--accent-9)) 40%, transparent) 0%, transparent 72%)',
          }}
        />
        <svg
          viewBox="-145 -145 290 290"
          role="img"
          aria-label={tTokenHoldings('chartAria', { title })}
          className="h-auto w-full max-w-[260px] transition-transform duration-300 ease-out group-hover:scale-[1.03] sm:max-w-[300px] xl:max-w-[320px]"
        >
          {pieData.map((segment: d3.PieArcDatum<ChartSlice>) => (
            <path
              key={`${segment.data.display_name}-${segment.index}`}
              d={arcGenerator(segment) ?? ''}
              fill={colorScale(segment.data.display_name)}
              stroke="var(--background)"
              strokeWidth={hoveredSliceKey === segment.data.hover_key ? 2 : 1}
              tabIndex={0}
              aria-label={`${segment.data.display_name}: ${PERCENTAGE_FORMATTER(
                segment.data.share_pct,
              )}% (${formatAmount(segment.data.balance, locale)})`}
              opacity={
                !hasHoveredSlice || hoveredSliceKey === segment.data.hover_key
                  ? 1
                  : 0.3
              }
              className="cursor-pointer transition-opacity duration-150"
              onMouseEnter={() => setHoveredSliceKey(segment.data.hover_key)}
              onMouseLeave={() => setHoveredSliceKey(null)}
              onFocus={() => setHoveredSliceKey(segment.data.hover_key)}
              onBlur={() => setHoveredSliceKey(null)}
            >
              <title>{`${segment.data.display_name} — ${PERCENTAGE_FORMATTER(
                segment.data.share_pct,
              )}% (${formatAmount(segment.data.balance, locale)})`}</title>
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
          <button
            type="button"
            key={`${slice.display_name}-${slice.address ?? 'other'}`}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 bg-transparent px-1 py-0.5 text-left transition-colors duration-150"
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
            onFocus={() => setHoveredSliceKey(slice.hover_key)}
            onBlur={() => setHoveredSliceKey(null)}
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

  const orderedPoints = React.useMemo(
    () =>
      [...chartPoints].sort(
        (a, b) => a.dateObj.getTime() - b.dateObj.getTime(),
      ),
    [chartPoints],
  );
  const timelinePoints = React.useMemo<ShareTimelinePoint[]>(
    () =>
      orderedPoints.map((point) => ({
        date: point.dateObj,
        share_pct: point.share_pct,
      })),
    [orderedPoints],
  );
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const memberOptions = history?.members ?? [
    { id: 'all', label: tTokenHoldings('distribution.memberAll') },
  ];
  const lastPoint = orderedPoints.at(-1);
  const firstPoint = orderedPoints[0];
  const netChange =
    firstPoint && lastPoint ? lastPoint.share_pct - firstPoint.share_pct : 0;
  const netChangeSign = netChange >= 0 ? '+' : '';
  const [hoveredPoint, setHoveredPoint] =
    React.useState<ShareTimelinePoint | null>(null);
  const activeTimelinePoint = hoveredPoint ?? timelinePoints.at(-1) ?? null;

  React.useEffect(() => {
    setHoveredPoint(null);
  }, [selectedToken, selectedMember]);

  return (
    <Card className="w-full overflow-hidden border-border/60 bg-card/95 shadow-[0_0_0_1px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_12%,transparent),0_22px_48px_-30px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_48%,transparent)]">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle className="text-lg">
              {tTokenHoldings('distribution.title')}
            </CardTitle>
            <CardDescription className="text-xs">
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
      <CardContent className="space-y-4 pt-1">
        {historyLoading ? (
          <Skeleton className="h-[360px] w-full" />
        ) : historyError ? (
          <p className="text-sm text-muted-foreground">
            {tTokenHoldings('distribution.error')}
          </p>
        ) : timelinePoints.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tTokenHoldings('distribution.empty')}
          </p>
        ) : (
          <>
            <ShareStepTimelineChart
              points={timelinePoints}
              activePoint={activeTimelinePoint}
              onActivePointChange={setHoveredPoint}
              percentageFormatter={(value) => `${PERCENTAGE_FORMATTER(value)}%`}
            />

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-sm"
                  style={{
                    background:
                      'linear-gradient(90deg, color-mix(in oklab, var(--space-accent, var(--accent-9)) 68%, white 32%), var(--space-accent, var(--accent-9)))',
                  }}
                />
                {tTokenHoldings('distribution.shareLabel')}
              </span>
              <span className="text-xs">
                {tTokenHoldings('distribution.hoverHint')}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs">
                <span className="h-2 w-2 rounded-full border border-dashed border-border" />
                {tTokenHoldings('distribution.baselineHint')}
              </span>
            </div>
          </>
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
    .value((item) => item.value)(chartInput);
  const arc = d3
    .arc<d3.PieArcDatum<(typeof chartInput)[number]>>()
    .innerRadius(68)
    .outerRadius(112);

  return (
    <Card className="flex h-full min-w-0 flex-col overflow-hidden border-border/60 bg-card/95">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">
          {tTokenHoldings('proposals.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {tTokenHoldings('proposals.subtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid flex-1 grid-cols-1 items-center gap-3 2xl:grid-cols-[1fr_auto]">
        <svg
          viewBox="-130 -130 260 260"
          className="h-[240px] w-full sm:h-[280px] 2xl:h-[340px]"
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

        <div className="flex min-w-0 flex-col gap-3 text-sm 2xl:min-w-[180px] 2xl:pr-2">
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
    <Card className="flex h-full min-w-0 flex-col overflow-hidden border-border/60 bg-card/95">
      <CardHeader className="pb-0">
        <CardTitle className="text-lg">
          {tTokenHoldings('members.title')}
        </CardTitle>
        <CardDescription className="text-xs">
          {tTokenHoldings('members.subtitle')}
        </CardDescription>
        <div className="flex items-center gap-2 pt-1 text-[11px]">
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">
            {tTokenHoldings('members.people')} {totals.people} (
            {totals.deltaPeople >= 0 ? '+' : ''}
            {totals.deltaPeople})
          </span>
          <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-muted-foreground">
            {tTokenHoldings('members.spaces')} {totals.spaces} (
            {totals.deltaSpaces >= 0 ? '+' : ''}
            {totals.deltaSpaces})
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-4">
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
                      {formatMonthLabel(item.month, locale)}
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
            {tTokenHoldings('members.people')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-3 w-3 rounded-sm"
              style={{ background: MEMBERS_COLOR_RANGE.spaces }}
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
  const validSignals = React.useMemo(
    () =>
      signals.items
        .map((signal) => ({
          ...signal,
          timestamp: new Date(signal.created_at).getTime(),
          priorityKey: signal.priority.toLowerCase(),
        }))
        .filter((signal) => Number.isFinite(signal.timestamp)),
    [signals.items],
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

type TreasuryAssetSlice = {
  label: string;
  symbol: string;
  usdEqual: number;
  share_pct: number;
  hover_key: string;
};

function buildTreasuryAssetSlices(
  assets: Array<{ symbol: string; name: string; usdEqual: number }>,
  collapseBelowPct = 3,
): TreasuryAssetSlice[] {
  const positive = assets
    .map((asset) => ({
      ...asset,
      usdEqual: Number(asset.usdEqual) || 0,
    }))
    .filter((asset) => asset.usdEqual > 0);
  const total = positive.reduce((sum, asset) => sum + asset.usdEqual, 0);
  if (total <= 0) {
    return [];
  }

  const ranked = positive
    .map((asset) => ({
      label: asset.symbol || asset.name,
      symbol: asset.symbol || asset.name,
      usdEqual: asset.usdEqual,
      share_pct: (asset.usdEqual / total) * 100,
      hover_key: `${asset.symbol}-${asset.name}`,
    }))
    .sort((a, b) => b.usdEqual - a.usdEqual);

  if (ranked.length <= 6) {
    return ranked;
  }

  const main = ranked.filter((asset) => asset.share_pct >= collapseBelowPct);
  const otherUsd = ranked
    .filter((asset) => asset.share_pct < collapseBelowPct)
    .reduce((sum, asset) => sum + asset.usdEqual, 0);

  if (otherUsd > 0) {
    main.push({
      label: 'Other',
      symbol: 'Other',
      usdEqual: otherUsd,
      share_pct: (otherUsd / total) * 100,
      hover_key: 'other',
    });
  }

  return main;
}

function TreasuryAssetHoldingCard({
  asset,
  getTokenTypeLabel,
}: {
  asset: {
    symbol: string;
    name: string;
    value: number;
    tokenPrice: number;
    usdEqual: number;
    type: string;
  };
  getTokenTypeLabel: (type: string) => string;
}) {
  const locale = useLocale();
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');

  return (
    <Card className="h-full min-w-0 overflow-hidden border-border/60 bg-card/95 shadow-[0_0_0_1px_color-mix(in_oklab,var(--space-accent,var(--accent-9))_8%,transparent)]">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{asset.name}</CardTitle>
            <CardDescription className="text-xs uppercase tracking-wide">
              {asset.symbol}
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0 border-border/60">
            {getTokenTypeLabel(asset.type)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {tTokenHoldings('assets.valueLabel')}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatUsdAmount(asset.usdEqual, locale)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {tTokenHoldings('assets.quantityLabel')}
            </p>
            <p className="text-2xl font-semibold tabular-nums text-foreground">
              {formatAmount(String(asset.value), locale)} {asset.symbol}
            </p>
          </div>
        </div>
        {asset.tokenPrice > 0 ? (
          <p className="text-xs text-muted-foreground">
            {tTokenHoldings('assets.unitPrice', {
              price: formatUsdAmount(asset.tokenPrice, locale),
            })}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TreasuryCompositionDonut({
  slices,
  title,
}: {
  slices: TreasuryAssetSlice[];
  title: string;
}) {
  const locale = useLocale();
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const [hoveredSliceKey, setHoveredSliceKey] = React.useState<string | null>(
    null,
  );

  const pieData = React.useMemo(
    () => d3.pie<TreasuryAssetSlice>().value((item) => item.usdEqual)(slices),
    [slices],
  );

  const outerRadius = 128;
  const innerRadius = 74;
  const arcGenerator = React.useMemo(
    () =>
      d3
        .arc<d3.PieArcDatum<TreasuryAssetSlice>>()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius),
    [],
  );

  const colorScale = React.useMemo(() => {
    const domain = slices.map((slice) => slice.label);
    return d3.scaleOrdinal<string, string>().domain(domain).range(COLOR_RANGE);
  }, [slices]);

  const hasHoveredSlice = hoveredSliceKey !== null;
  const centerLabel =
    slices.find((slice) => slice.hover_key === hoveredSliceKey)?.label ?? title;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative flex w-full items-center justify-center xl:w-auto xl:flex-none">
        <svg
          viewBox="-145 -145 290 290"
          role="img"
          aria-label={tTokenHoldings('assets.compositionAria', { title })}
          className="h-auto w-full max-w-[260px] sm:max-w-[300px] xl:max-w-[320px]"
        >
          {pieData.map((segment) => (
            <path
              key={`${segment.data.hover_key}-${segment.index}`}
              d={arcGenerator(segment) ?? ''}
              fill={colorScale(segment.data.label)}
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
              <title>{`${segment.data.label} — ${PERCENTAGE_FORMATTER(
                segment.data.share_pct,
              )}% (${formatUsdAmount(segment.data.usdEqual, locale)})`}</title>
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
        {slices.map((slice) => (
          <button
            type="button"
            key={slice.hover_key}
            className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border-0 bg-transparent px-1 py-0.5 text-left"
            style={{
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
                style={{ backgroundColor: colorScale(slice.label) }}
              />
              <span className="truncate text-sm text-foreground/90">
                {slice.label}
              </span>
            </div>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {PERCENTAGE_FORMATTER(slice.share_pct)}% ·{' '}
              {formatUsdAmount(slice.usdEqual, locale)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TreasuryTopAssetsBarChart({ items }: { items: TreasuryAssetSlice[] }) {
  const locale = useLocale();
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const max = Math.max(...items.map((item) => item.usdEqual), 1);

  return (
    <Card className="h-full min-w-0 overflow-hidden border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          {tTokenHoldings('assets.topHoldings')}
        </CardTitle>
        <CardDescription className="text-xs">
          {tTokenHoldings('assets.topHoldingsSubtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {tTokenHoldings('assets.emptyDescription')}
          </p>
        ) : (
          items.map((item, index) => {
            const barColor =
              COLOR_RANGE[index % COLOR_RANGE.length] ?? COLOR_RANGE[0];
            return (
              <div key={item.hover_key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-medium text-muted-foreground">
                    {formatUsdAmount(item.usdEqual, locale)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/80">
                  <div
                    className="h-2 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(4, (item.usdEqual / max) * 100)}%`,
                      background: `linear-gradient(90deg, color-mix(in oklab, ${barColor} 70%, white 30%), ${barColor})`,
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function TreasuryTypeBreakdownChart({
  assets,
  getTokenTypeLabel,
}: {
  assets: Array<{ type: string; usdEqual: number }>;
  getTokenTypeLabel: (type: string) => string;
}) {
  const locale = useLocale();
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const rows = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const asset of assets) {
      const usdEqual = Number(asset.usdEqual) || 0;
      if (usdEqual <= 0) continue;
      const type = asset.type?.trim() || 'other';
      totals.set(type, (totals.get(type) ?? 0) + usdEqual);
    }
    return Array.from(totals.entries())
      .map(([type, usdEqual]) => ({
        type,
        label: getTokenTypeLabel(type),
        usdEqual,
      }))
      .sort((a, b) => b.usdEqual - a.usdEqual);
  }, [assets, getTokenTypeLabel]);

  const max = Math.max(...rows.map((row) => row.usdEqual), 1);

  return (
    <Card className="h-full min-w-0 overflow-hidden border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">
          {tTokenHoldings('assets.byType')}
        </CardTitle>
        <CardDescription className="text-xs">
          {tTokenHoldings('assets.byTypeSubtitle')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((row, index) => {
          const barColor =
            COLOR_RANGE[index % COLOR_RANGE.length] ?? COLOR_RANGE[0];
          return (
            <div key={row.type} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{row.label}</span>
                <span className="font-medium text-muted-foreground">
                  {formatUsdAmount(row.usdEqual, locale)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted/80">
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(4, (row.usdEqual / max) * 100)}%`,
                    background: `linear-gradient(90deg, color-mix(in oklab, ${barColor} 70%, white 30%), ${barColor})`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TreasuryAssetsSummaryWidget({
  assets,
  balance,
  isLoading,
  error,
  getTokenTypeLabel,
}: {
  assets: Array<{
    symbol: string;
    name: string;
    usdEqual: number;
    value: number;
    tokenPrice: number;
    type: string;
  }>;
  balance: number;
  isLoading: boolean;
  error?: string | null;
  getTokenTypeLabel: (type: string) => string;
}) {
  const locale = useLocale();
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const holdings = React.useMemo(
    () =>
      [...assets]
        .filter((asset) => (Number(asset.value) || 0) > 0)
        .sort((a, b) => b.usdEqual - a.usdEqual || b.value - a.value),
    [assets],
  );
  const slices = React.useMemo(
    () =>
      buildTreasuryAssetSlices(
        holdings.map((asset) => ({
          symbol: asset.symbol,
          name: asset.name,
          usdEqual: asset.usdEqual,
        })),
      ),
    [holdings],
  );
  const topHoldings = React.useMemo(
    () =>
      [...slices]
        .filter((slice) => slice.hover_key !== 'other')
        .sort((a, b) => b.usdEqual - a.usdEqual)
        .slice(0, 8),
    [slices],
  );
  const topShare = slices[0]?.share_pct ?? 0;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tTokenHoldings('assets.errorTitle')}</CardTitle>
          <CardDescription>
            {tTokenHoldings('assets.errorDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (holdings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{tTokenHoldings('assets.emptyTitle')}</CardTitle>
          <CardDescription>
            {tTokenHoldings('assets.emptyDescription')}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-3 font-normal text-muted-foreground">
              {tTokenHoldings('assets.totalBalance')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {tTokenHoldings('assets.valueLabel')}
            </p>
            <p className="mt-1 text-6 font-semibold tabular-nums">
              {formatUsdAmount(balance, locale)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-3 font-normal text-muted-foreground">
              {tTokenHoldings('assets.assetCount')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-6 font-semibold">{holdings.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-3 font-normal text-muted-foreground">
              {tTokenHoldings('assets.largestHolding')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-6 font-semibold">
              {PERCENTAGE_FORMATTER(topShare)}%
            </p>
            {slices[0] ? (
              <p className="mt-1 text-2 text-muted-foreground">
                {slices[0].label}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid min-w-0 items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        {holdings.map((asset) => (
          <TreasuryAssetHoldingCard
            key={`${asset.symbol}-${asset.name}`}
            asset={asset}
            getTokenTypeLabel={getTokenTypeLabel}
          />
        ))}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden border-border/60 bg-card/95">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {tTokenHoldings('assets.composition')}
            </CardTitle>
            <CardDescription className="text-xs">
              {tTokenHoldings('assets.compositionSubtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TreasuryCompositionDonut
              title={tTokenHoldings('assets.composition')}
              slices={slices}
            />
          </CardContent>
        </Card>
        <TreasuryTopAssetsBarChart items={topHoldings} />
      </div>

      <TreasuryTypeBreakdownChart
        assets={holdings}
        getTokenTypeLabel={getTokenTypeLabel}
      />
    </div>
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
  const [activeFilter, setActiveFilter] =
    React.useState<HomeSectionFilter>('signals');
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

  const getTokenTypeLabel = React.useCallback(
    (type: string | undefined | null) => {
      const normalizedType = type?.trim() || 'other';
      const translationKey = `plugins.issueNewToken.general.tokenTypeOptions.${normalizedType}.label`;
      try {
        const translated = tModalAside(translationKey);
        if (isLikelyI18nKey(translated)) {
          return prettifyTokenType(normalizedType);
        }
        return capitalizeWords(translated);
      } catch {
        return prettifyTokenType(normalizedType);
      }
    },
    [tModalAside],
  );
  const hasEnergyData = Boolean(activityData?.energy.available);
  const isHyphaPlatform = isHyphaPlatformSpace({ slug: spaceSlug });
  // Temporarily hidden for deployment/testing; re-enable by switching to `hasEnergyData`.
  const showEnergyWidget = false && hasEnergyData;
  const filterItems = React.useMemo(
    () =>
      [
        ...(showEnergyWidget
          ? [{ value: 'energy', label: tTokenHoldings('filters.energy') }]
          : []),
        { value: 'signals', label: tTokenHoldings('filters.signals') },
        { value: 'activity', label: tTokenHoldings('filters.activity') },
        { value: 'memory', label: tTokenHoldings('filters.memory') },
        {
          value: 'distribution',
          label: tTokenHoldings('filters.distribution'),
        },
        { value: 'assets', label: tTokenHoldings('filters.assets') },
        ...(isHyphaPlatform
          ? [{ value: 'flows', label: tTokenHoldings('filters.activeSpaces') }]
          : []),
      ] as Array<{ value: HomeSectionFilter; label: string }>,
    [isHyphaPlatform, showEnergyWidget, tTokenHoldings],
  );
  const showSignals = activeFilter === 'signals';
  const showActivity = activeFilter === 'activity';
  const showMemory = activeFilter === 'memory';
  const showDistribution = activeFilter === 'distribution';
  const showAssets = activeFilter === 'assets';
  const showFlows = activeFilter === 'flows';
  const {
    data: assetsData,
    error: assetsError,
    isLoading: assetsLoading,
  } = useSWR(
    showAssets && authReady
      ? ['space-overview-assets', spaceSlug, authKey]
      : null,
    fetchSpaceAssets(spaceSlug, getAccessToken),
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );
  const treasuryAssets = assetsData?.assets ?? [];
  const treasuryBalance = assetsData?.balance ?? 0;
  const showDistributionHistoryWidget = true;

  React.useEffect(() => {
    if (activeFilter === 'energy' && !showEnergyWidget) {
      setActiveFilter('signals');
    }
    if (activeFilter === 'flows' && !isHyphaPlatform) {
      setActiveFilter('signals');
    }
  }, [activeFilter, isHyphaPlatform, showEnergyWidget]);

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

      {showSignals ? (
        <>
          {!activityLoading && activityError ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {tTokenHoldings('signalsDashboard.errorTitle')}
                </CardTitle>
                <CardDescription>
                  {tTokenHoldings('activity.error')}
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          <OverviewSignalsDashboard
            spaceSlug={spaceSlug}
            authReady={authReady}
            authKey={authKey}
            afterSummary={
              !activityLoading && !activityError && activityData ? (
                <SignalsPulseMapWidget signals={activityData.signals} />
              ) : null
            }
          />
        </>
      ) : null}

      {showMemory ? (
        <OverviewMemoryDashboard
          spaceSlug={spaceSlug}
          authReady={authReady}
          authKey={authKey}
        />
      ) : null}

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
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
              <MembersEvolutionWidget
                monthly={activityData.members.monthly}
                locale={locale}
              />
              <ProposalsPieWidget data={activityData.proposals} />
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
            <div className="flex flex-col gap-4">
              <div className="grid min-w-0 items-stretch gap-4 md:grid-cols-2">
                {data.tokens.map((token) => (
                  <Card
                    key={token.token_address}
                    className="group flex h-full min-w-0 flex-col overflow-hidden border-border/50 bg-card/90 backdrop-blur-sm"
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
                                  aria-label={tTokenHoldings(
                                    'tokenDetailsAria',
                                    {
                                      tokenName: token.name,
                                    },
                                  )}
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
                                    {formatAmount(
                                      token.treasury_balance,
                                      locale,
                                    )}
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
                                  <span className="break-all font-mono">
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
                    <CardContent className="flex flex-1 flex-col pt-0">
                      <TokenDonutChart
                        title={token.symbol}
                        slices={token.holdings}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>

              {showDistributionHistoryWidget ? (
                <DistributionOverTimeChart
                  spaceSlug={spaceSlug}
                  tokens={data.tokens}
                  getAccessToken={getAccessToken}
                />
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {showFlows && isHyphaPlatform ? (
        <OverviewFlowsDashboard
          spaceSlug={spaceSlug}
          authReady={authReady}
          authKey={authKey}
        />
      ) : null}

      {showAssets ? (
        <TreasuryAssetsSummaryWidget
          assets={treasuryAssets}
          balance={treasuryBalance}
          isLoading={assetsLoading}
          error={assetsError?.message ?? null}
          getTokenTypeLabel={getTokenTypeLabel}
        />
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
