'use client';

import { z } from 'zod';

export const tokenHoldingSuccessSchema = z.object({
  found: z.boolean(),
  space_slug: z.string(),
  asOf: z.string(),
  holders_complete: z.boolean().optional(),
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

export type TokenHoldingResponse = z.infer<typeof tokenHoldingSuccessSchema>;

export class TokenHoldingsFetchError extends Error {
  constructor(
    message: string,
    public readonly code: string | null,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'TokenHoldingsFetchError';
  }
}

export type TokenHoldingsFetchOptions = {
  includeTreasury?: boolean;
  collapseBelowPct?: number;
  holderLimit?: number;
  expandUnknownHolders?: boolean;
};

/** Chart query: named slices ≥0.5%, capped at top 10 (+ Other for the rest). */
export const TOKEN_HOLDINGS_CHART_QUERY: Required<
  Omit<TokenHoldingsFetchOptions, 'expandUnknownHolders'>
> = {
  includeTreasury: true,
  collapseBelowPct: 0.5,
  holderLimit: 10,
};

/** Export query: full per-wallet list, no chart collapse, cap, or Other bucket. */
export const TOKEN_HOLDINGS_EXPORT_QUERY: TokenHoldingsFetchOptions = {
  includeTreasury: true,
  collapseBelowPct: 0,
  expandUnknownHolders: true,
};

export function buildTokenHoldingsSearchParams(
  options: TokenHoldingsFetchOptions = {},
): URLSearchParams {
  const params = new URLSearchParams();
  params.set(
    'include_treasury',
    options.includeTreasury ?? true ? 'true' : 'false',
  );
  if (options.collapseBelowPct != null) {
    params.set('collapse_below_pct', String(options.collapseBelowPct));
  }
  if (options.holderLimit != null) {
    params.set('holder_limit', String(options.holderLimit));
  }
  if (options.expandUnknownHolders != null) {
    params.set(
      'expand_unknown_holders',
      options.expandUnknownHolders ? 'true' : 'false',
    );
  }
  return params;
}

export async function fetchTokenHoldings(
  slug: string,
  getAccessToken: (() => Promise<string | null>) | undefined,
  options: TokenHoldingsFetchOptions = TOKEN_HOLDINGS_CHART_QUERY,
): Promise<TokenHoldingResponse> {
  const token = await getAccessToken?.();
  const headers: HeadersInit = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const params = buildTokenHoldingsSearchParams(options);
  const response = await fetch(
    `/api/v1/spaces/${slug}/token-holdings?${params.toString()}`,
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
      (parsedErrorEnvelope.success ? parsedErrorEnvelope.data.reason : null) ??
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
}

export function createTokenHoldingsFetcher(
  slug: string,
  getAccessToken: (() => Promise<string | null>) | undefined,
  options: TokenHoldingsFetchOptions = TOKEN_HOLDINGS_CHART_QUERY,
) {
  return () => fetchTokenHoldings(slug, getAccessToken, options);
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
