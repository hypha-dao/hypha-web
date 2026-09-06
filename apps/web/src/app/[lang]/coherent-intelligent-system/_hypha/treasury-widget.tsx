'use client';

import { z } from 'zod';
import type { WidgetDefinition } from '@hypha-platform/epics';
import { Badge } from '@hypha-platform/ui';

import { useSpaceJson } from './use-space-json';

/**
 * #2486 v0 `treasury` widget — a thin adapter over the space assets REST route
 * (`/assets?bestEffort=true`, the same endpoint `useAssets` uses). v0 renders a
 * compact holdings list + total USD balance; no search / load-more / issue-token
 * chrome from the full `AssetsSection`.
 */
const treasuryParams = z.object({
  spaceSlug: z.string().trim().min(1),
  limit: z.number().int().positive().max(20).optional(),
});

type TreasuryParams = z.infer<typeof treasuryParams>;

const DEFAULT_LIMIT = 8;

type Asset = {
  name?: string;
  symbol?: string;
  icon?: string;
  type?: string;
  value?: number;
  usdEqual?: number;
  address?: string;
};

type AssetsResponse = { assets?: Asset[]; balance?: number };

function formatNumber(value: number | undefined, maximumFractionDigits = 4) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';
  return value.toLocaleString(undefined, { maximumFractionDigits });
}

function formatUsd(value: number | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '$0';
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

function TreasuryWidget({ params }: { params: TreasuryParams }) {
  const { data, isLoading } = useSpaceJson<AssetsResponse>(
    `/api/v1/spaces/${params.spaceSlug}/assets?bestEffort=true`,
  );

  const assets = Array.isArray(data?.assets) ? data!.assets! : [];
  const visible = assets.slice(0, params.limit ?? DEFAULT_LIMIT);

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Treasury</h2>
        <span className="text-xs text-muted-foreground">
          {isLoading && assets.length === 0
            ? 'Loading…'
            : formatUsd(data?.balance)}
        </span>
      </div>

      {!isLoading && visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No holdings to show.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {visible.map((asset, index) => (
            <li
              key={asset.address ?? asset.symbol ?? index}
              className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-center gap-2">
                {asset.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={asset.icon}
                    alt=""
                    className="h-5 w-5 shrink-0 rounded-full"
                  />
                ) : null}
                <span className="truncate text-sm font-medium">
                  {asset.name || asset.symbol || 'Token'}
                </span>
                {asset.type ? (
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {asset.type}
                  </Badge>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm">
                  {formatNumber(asset.value)} {asset.symbol ?? ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatUsd(asset.usdEqual)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const treasuryWidget: WidgetDefinition<TreasuryParams> = {
  id: 'treasury',
  title: 'Treasury',
  paramsSchema: treasuryParams,
  component: TreasuryWidget,
  describeForModel: () =>
    "treasury — this space's treasury token holdings with per-token balance and total USD value. params: spaceSlug (required), limit? (1-20, default 8).",
};
