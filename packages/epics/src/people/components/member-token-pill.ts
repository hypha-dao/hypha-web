/**
 * The member top-bar pill is the space's primary minted token, and only when
 * that token is in the signed-in wallet. A zero balance hides the pill.
 *
 * Primary means the community token (credits, community currency, utility,
 * impact), oldest first. Ownership and voice are used only when the space
 * minted nothing in those primary types.
 */

export type MemberMintedToken = {
  address?: string | null;
  symbol?: string | null;
  type?: string | null;
  createdAt?: string | number | Date | null;
  archived?: boolean | null;
  spaceId?: number | null;
};

export type MemberTokenHolding = {
  address?: string | null;
  value?: number | null;
};

const PRIMARY_TYPES = [
  'credits',
  'community_currency',
  'utility',
  'impact',
] as const;

const FALLBACK_TYPES = ['ownership', 'voice'] as const;

function createdAtTime(value: MemberMintedToken['createdAt']): number {
  if (value == null || value === '') return Number.MAX_SAFE_INTEGER;
  const parsed =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function pickPrimary(
  tokens: readonly MemberMintedToken[],
  types: readonly string[],
): MemberMintedToken | null {
  const eligible = tokens.filter((token) => {
    const type = token.type?.trim();
    return Boolean(
      token.address?.trim() &&
        token.symbol?.trim() &&
        type &&
        types.includes(type) &&
        token.archived !== true,
    );
  });
  eligible.sort((left, right) => {
    const byType =
      types.indexOf(left.type?.trim() ?? '') -
      types.indexOf(right.type?.trim() ?? '');
    if (byType !== 0) return byType;
    return createdAtTime(left.createdAt) - createdAtTime(right.createdAt);
  });
  return eligible[0] ?? null;
}

export function selectMemberTokenPill(input: {
  minted: readonly MemberMintedToken[];
  holdings: readonly MemberTokenHolding[];
}): { symbol: string; amount: number } | null {
  const primary =
    pickPrimary(input.minted, PRIMARY_TYPES) ??
    pickPrimary(input.minted, FALLBACK_TYPES);
  const address = primary?.address?.trim().toLowerCase();
  const symbol = primary?.symbol?.trim();
  if (!address || !symbol) return null;
  const holding = input.holdings.find(
    (row) =>
      row.address?.trim().toLowerCase() === address && (row.value ?? 0) > 0,
  );
  if (holding?.value == null || !Number.isFinite(holding.value)) return null;
  return { symbol: symbol.toUpperCase(), amount: holding.value };
}

export function formatMemberTokenAmount(amount: number, locale = 'en'): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(amount);
}
