'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { useAuthentication } from '@hypha-platform/authentication';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
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

const PERCENTAGE_FORMATTER = d3.format('.1f');
const NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});
const COLOR_RANGE = [
  'var(--accent-9)',
  'var(--info-9)',
  'var(--success-9)',
  'var(--warning-9)',
  'var(--neutral-9)',
  'var(--accent-8)',
  'var(--info-8)',
  'var(--success-8)',
];

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

function TokenDonutChart({
  title,
  slices,
}: {
  title: string;
  slices: TokenHoldingResponse['tokens'][number]['holdings'];
}) {
  const chartData = React.useMemo(
    () =>
      slices
        .map((slice) => ({ ...slice, numeric: toNumericValue(slice.balance) }))
        .filter((slice) => slice.numeric > 0),
    [slices],
  );

  const pieData = React.useMemo(() => {
    const generator = d3
      .pie<ChartSlice>()
      .value((item: ChartSlice) => item.numeric);
    return generator(chartData);
  }, [chartData]);

  const outerRadius = 72;
  const innerRadius = 42;
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
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex items-center justify-center">
        <svg
          viewBox="-90 -90 180 180"
          role="img"
          aria-label={`Token distribution chart for ${title}`}
          className="h-44 w-44"
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
            className="fill-foreground text-[11px] font-medium"
          >
            {title}
          </text>
        </svg>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {chartData.map((slice) => (
          <div
            key={`${slice.display_name}-${slice.address ?? 'other'}`}
            className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background-2/30 px-2 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorScale(slice.display_name) }}
              />
              <span className="truncate text-sm text-foreground">
                {slice.display_name}
              </span>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {PERCENTAGE_FORMATTER(slice.share_pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
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
  const { data, error, isLoading } = useSWR(
    ['space-token-holdings-home', spaceSlug],
    fetchHoldings(spaceSlug, getAccessToken),
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );

  const tokenCount = data?.tokens.length ?? 0;
  const lastUpdatedLabel = data?.asOf
    ? new Date(data.asOf).toLocaleString()
    : null;

  return (
    <div className="flex flex-col gap-5 py-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-7 font-semibold tracking-tight text-foreground">
          Home
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Overview transparency dashboard for space-issued tokens and recipient
          distribution.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Tokens: {tokenCount}</Badge>
        <Badge variant="outline">Other bucket: &lt; 3%</Badge>
        <Badge variant="outline">Treasury always visible</Badge>
        {lastUpdatedLabel ? (
          <span className="text-xs text-muted-foreground">
            Updated {lastUpdatedLabel}
          </span>
        ) : null}
      </div>

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
        <div className="grid gap-4 md:grid-cols-2">
          {data.tokens.map((token) => (
            <Card
              key={token.token_address}
              className="border-border/70 bg-card/95"
            >
              <CardHeader className="gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="truncate">
                      {token.name} ({token.symbol})
                    </CardTitle>
                    <CardDescription className="truncate">
                      {token.token_address}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {token.type}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span>Total supply: {formatAmount(token.total_supply)}</span>
                  <span>Treasury: {formatAmount(token.treasury_balance)}</span>
                  <span>Other: {formatAmount(token.other_balance)}</span>
                  <span>
                    Tracked: {formatAmount(token.total_holders_balance)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <TokenDonutChart title={token.symbol} slices={token.holdings} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
