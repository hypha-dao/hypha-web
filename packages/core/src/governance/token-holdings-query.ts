import { isAddress } from 'viem';

export type TokenHoldingsFetchOptions = {
  includeTreasury?: boolean;
  collapseBelowPct?: number;
  holderLimit?: number;
  expandUnknownHolders?: boolean;
  /** Restrict the response to a single space token (0x address). */
  tokenAddress?: string;
};

/** Chart query: named slices ≥0.5%, capped at top 10 (+ Other for the rest). */
export const TOKEN_HOLDINGS_CHART_QUERY: Required<
  Omit<TokenHoldingsFetchOptions, 'expandUnknownHolders' | 'tokenAddress'>
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

export type ParsedTokenAddressQuery =
  | { status: 'none' }
  | { status: 'invalid' }
  | { status: 'ok'; address: `0x${string}` };

export function parseTokenAddressQuery(
  raw: string | null | undefined,
): ParsedTokenAddressQuery {
  if (raw == null) return { status: 'none' };
  const value = raw.trim();
  if (value === '') return { status: 'none' };
  if (!isAddress(value)) {
    return { status: 'invalid' };
  }
  return {
    status: 'ok',
    address: value.toLowerCase() as `0x${string}`,
  };
}

export function applyTokenAddressFilter<T extends string>(
  tokenAddresses: readonly T[],
  tokenAddress?: string | null,
): T[] {
  if (tokenAddress == null || tokenAddress === '') {
    return [...tokenAddresses];
  }
  const normalized = tokenAddress.toLowerCase();
  return tokenAddresses.filter(
    (address) => address.toLowerCase() === normalized,
  );
}

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
  if (options.tokenAddress) {
    params.set('token_address', options.tokenAddress);
  }
  return params;
}
