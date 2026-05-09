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
  numeric: number;
};

type ActivityResponse = {
  found: boolean;
  space_slug: string;
  asOf: string;
  proposals: {
    onVoting: number;
    accepted: number;
    refused: number;
    onVotingItems: Array<{
      id: number;
      title: string;
      description: string;
      label: string | null;
      status: string;
      updated_at: string;
    }>;
  };
  signals: {
    total: number;
    priorities: string[];
    types: string[];
    tags: string[];
    items: Array<{
      id: number;
      title: string;
      description: string;
      priority: string;
      type: string;
      tags: string[];
      created_at: string;
    }>;
  };
};

type HomeSectionFilter = 'activity' | 'distribution';

const PERCENTAGE_FORMATTER = d3.format('.1f');
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
  const value = raw.trim();
  if (!/^-?\d+(\.\d+)?$/.test(value)) return raw;
  const isNegative = value.startsWith('-');
  const unsigned = isNegative ? value.slice(1) : value;
  const [integerPart, fractionalPart] = unsigned.split('.');
  const groupedInteger = (integerPart ?? '0').replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ',',
  );
  const exact = fractionalPart
    ? `${groupedInteger}.${fractionalPart}`
    : groupedInteger;
  return isNegative ? `-${exact}` : exact;
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
          aria-label={`Token distribution chart for ${title}`}
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
              {PERCENTAGE_FORMATTER(slice.share_pct)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function summarizeText(value: string, fallback: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) return fallback;
  return normalized.length > 160
    ? `${normalized.slice(0, 157)}...`
    : normalized;
}

function OnVotingProposalsListPanel({
  proposals,
}: {
  proposals: ActivityResponse['proposals'];
}) {
  const items = proposals.onVotingItems;
  const now = new Date();
  const urgencyByProposal = items.map((item) => {
    const updatedAt = new Date(item.updated_at);
    const ageDays = Number.isNaN(updatedAt.getTime())
      ? 0
      : Math.max(0, (now.getTime() - updatedAt.getTime()) / 86_400_000);
    return { id: item.id, ageDays };
  });
  const maxAge = Math.max(1, ...urgencyByProposal.map((item) => item.ageDays));
  const urgencyWidth = d3.scaleLinear().domain([0, maxAge]).range([28, 124]);

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">On-voting proposals</CardTitle>
        <CardDescription className="text-xs">
          Active decisions requiring attention from members.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((proposal) => {
            const ageDays =
              urgencyByProposal.find((item) => item.id === proposal.id)
                ?.ageDays ?? 0;
            return (
              <div
                key={proposal.id}
                className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">
                    {proposal.title}
                  </p>
                  <svg
                    viewBox="0 0 130 8"
                    className="h-2 w-[88px] shrink-0"
                    aria-label="Proposal urgency indicator"
                  >
                    <rect
                      x={0}
                      y={0}
                      width={126}
                      height={8}
                      rx={999}
                      fill="var(--muted)"
                    />
                    <rect
                      x={1}
                      y={1}
                      width={Math.max(6, urgencyWidth(ageDays))}
                      height={6}
                      rx={999}
                      fill="var(--space-accent, var(--accent-9))"
                      opacity={0.9}
                    />
                  </svg>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {summarizeText(
                    proposal.description,
                    'Open proposal with pending decision details.',
                  )}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            No proposals are currently on voting.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function SignalsActionListPanel({
  signals,
}: {
  signals: ActivityResponse['signals'];
}) {
  const priorityRadius = d3
    .scaleOrdinal<string, number>()
    .domain(['critical', 'high', 'medium', 'low'])
    .range([7, 6, 5, 4]);
  const priorityColor = d3
    .scaleOrdinal<string, string>()
    .domain(['critical', 'high', 'medium', 'low'])
    .range([
      'var(--error-9)',
      'var(--warning-9)',
      'var(--space-accent, var(--accent-9))',
      'var(--info-9)',
    ]);

  const items = signals.items.slice(0, 12);

  return (
    <Card className="border-border/60 bg-card/95">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Signals to act on</CardTitle>
        <CardDescription className="text-xs">
          Emerging opportunities and risks with context for next actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((signal) => {
            const priorityKey = signal.priority.toLowerCase();
            return (
              <div
                key={signal.id}
                className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2"
              >
                <div className="mb-1 flex items-center gap-2">
                  <svg
                    viewBox="0 0 18 18"
                    className="h-[18px] w-[18px] shrink-0"
                    aria-label={`Signal priority ${signal.priority}`}
                  >
                    <circle
                      cx={9}
                      cy={9}
                      r={priorityRadius(priorityKey) ?? 4}
                      fill={priorityColor(priorityKey) ?? 'var(--accent-9)'}
                      opacity={0.92}
                    />
                  </svg>
                  <p className="line-clamp-1 text-sm font-semibold text-foreground">
                    {signal.title}
                  </p>
                  <span className="ml-auto text-[11px] uppercase tracking-wide text-muted-foreground">
                    {signal.type}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {summarizeText(
                    signal.description,
                    'Signal captured for coordination and prioritization.',
                  )}
                </p>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-muted-foreground">
            No active signals right now.
          </p>
        )}
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

  const tokenCount = data?.tokens.length ?? 0;
  const lastUpdatedLabel = data?.asOf
    ? new Date(data.asOf).toLocaleString()
    : null;
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
          Token distribution at a glance.
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

      <Tabs
        value={activeFilter}
        onValueChange={(value) => setActiveFilter(value as HomeSectionFilter)}
      >
        <TabsList triggerVariant="switch" className="w-fit">
          <TabsTrigger value="activity" variant="switch">
            Activity
          </TabsTrigger>
          <TabsTrigger value="distribution" variant="switch">
            Distribution
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeFilter === 'activity' ? (
        <>
          {activityLoading ? <LoadingState /> : null}

          {!activityLoading && activityError ? (
            <Card>
              <CardHeader>
                <CardTitle>Unable to load activity widgets</CardTitle>
                <CardDescription>
                  Please retry in a moment. Activity data may still be syncing.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : null}

          {!activityLoading && !activityError && activityData ? (
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <OnVotingProposalsListPanel proposals={activityData.proposals} />
              <SignalsActionListPanel signals={activityData.signals} />
            </div>
          ) : null}
        </>
      ) : null}

      {activeFilter === 'distribution' ? (
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
                                <span>{formatAmount(token.total_supply)}</span>
                                <span className="text-muted-foreground">
                                  {tCommon('Treasury')}
                                </span>
                                <span>
                                  {formatAmount(token.treasury_balance)}
                                </span>
                                <span className="text-muted-foreground">
                                  Other
                                </span>
                                <span>{formatAmount(token.other_balance)}</span>
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
                  <CardContent>
                    <TokenDonutChart
                      title={token.symbol}
                      slices={token.holdings}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
