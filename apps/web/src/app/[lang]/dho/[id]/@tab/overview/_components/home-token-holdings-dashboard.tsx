'use client';

import * as React from 'react';
import useSWR from 'swr';
import * as d3 from 'd3';
import { useAuthentication } from '@hypha-platform/authentication';
import { useFormatter, useTranslations } from 'next-intl';
import { CircleHelp } from 'lucide-react';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
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

function TokenDonutChart({
  title,
  slices,
  chartAriaLabel,
  formatSharePercent,
}: {
  title: string;
  slices: TokenHoldingResponse['tokens'][number]['holdings'];
  chartAriaLabel: string;
  formatSharePercent: (value: number) => string;
}) {
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

  const outerRadius = 92;
  const innerRadius = 52;
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
    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div className="relative flex items-center justify-center md:flex-none">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-40 w-40 rounded-full opacity-80 blur-2xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in oklab, var(--space-accent, var(--accent-9)) 30%, transparent) 0%, transparent 70%)',
          }}
        />
        <svg
          viewBox="-110 -110 220 220"
          role="img"
          aria-label={chartAriaLabel}
          className="h-60 w-60 transition-transform duration-300 ease-out group-hover:scale-[1.03]"
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
            className="fill-foreground text-[12px] font-semibold"
          >
            {title}
          </text>
        </svg>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:max-w-[34%]">
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
              {formatSharePercent(slice.share_pct)}
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
  const format = useFormatter();
  const { getAccessToken } = useAuthentication();
  const tModalAside = useTranslations('ModalAside');
  const tCommon = useTranslations('Common');
  const tTokenHoldings = useTranslations('TokenHoldingsDashboard');
  const { data, error, isLoading } = useSWR(
    ['space-token-holdings-home', spaceSlug],
    fetchHoldings(spaceSlug, getAccessToken),
    { revalidateOnFocus: true, refreshInterval: 60_000 },
  );

  const tokenCount = data?.tokens.length ?? 0;
  const lastUpdatedLabel = data?.asOf
    ? format.dateTime(new Date(data.asOf), {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;
  const formatAmount = React.useCallback(
    (raw: string): string => {
      const parsed = Number.parseFloat(raw);
      if (!Number.isFinite(parsed)) return raw;
      return format.number(parsed, {
        maximumFractionDigits: 2,
      });
    },
    [format],
  );
  const formatSharePercent = React.useCallback(
    (value: number) =>
      format.number(value / 100, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [format],
  );
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

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">
          {tTokenHoldings('badges.tokens', { count: tokenCount })}
        </Badge>
        <Badge variant="outline">{tTokenHoldings('badges.otherBucket')}</Badge>
        <Badge variant="outline">
          {tTokenHoldings('badges.treasuryVisible')}
        </Badge>
        {lastUpdatedLabel ? (
          <span className="text-xs text-muted-foreground">
            {tTokenHoldings('updatedAt', { date: lastUpdatedLabel })}
          </span>
        ) : null}
      </div>

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
              className="group border-border/50 bg-card/90 backdrop-blur-sm"
            >
              <CardHeader className="gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="truncate">{token.name}</CardTitle>
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
                            <span>{formatAmount(token.total_supply)}</span>
                            <span className="text-muted-foreground">
                              {tCommon('Treasury')}
                            </span>
                            <span>{formatAmount(token.treasury_balance)}</span>
                            <span className="text-muted-foreground">
                              {tTokenHoldings('tooltip.other')}
                            </span>
                            <span>{formatAmount(token.other_balance)}</span>
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
                  chartAriaLabel={tTokenHoldings('chartAria', {
                    title: token.symbol,
                  })}
                  formatSharePercent={formatSharePercent}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}
