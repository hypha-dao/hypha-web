export const TOKEN_HOLDINGS_CSV_COLUMNS = [
  'token_name',
  'token_symbol',
  'token_address',
  'holder_kind',
  'display_name',
  'slug',
  'address',
  'balance',
  'share_pct',
  'balance_raw',
] as const;

export type TokenHoldingsCsvHolding = {
  holder_kind: string;
  address: string | null;
  display_name: string;
  slug: string | null;
  balance: string;
  balance_raw: string;
  share_pct: number;
};

export type TokenHoldingsCsvToken = {
  name: string;
  symbol: string;
  token_address: string;
  holdings: TokenHoldingsCsvHolding[];
};

export function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function nullableField(value: string | null | undefined): string {
  return value == null ? '' : value;
}

/**
 * Builds a UTF-8 CSV of the full holder list across all tokens.
 * Column names stay English so the file stays machine-readable across locales.
 */
export function buildTokenHoldingsCsv(
  tokens: readonly TokenHoldingsCsvToken[],
): string {
  const lines = [TOKEN_HOLDINGS_CSV_COLUMNS.join(',')];

  for (const token of tokens) {
    for (const holding of token.holdings) {
      const row = [
        token.name,
        token.symbol,
        token.token_address,
        holding.holder_kind,
        holding.display_name,
        nullableField(holding.slug),
        nullableField(holding.address),
        holding.balance,
        String(holding.share_pct),
        holding.balance_raw,
      ].map(escapeCsvField);
      lines.push(row.join(','));
    }
  }

  return `${lines.join('\n')}\n`;
}

export function tokenHoldingsCsvFilename(
  spaceSlug: string,
  date = new Date(),
): string {
  const safeSlug =
    spaceSlug
      .replace(/[/\\]+/g, '-')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^\.+/, '')
      .replace(/^-+|-+$/g, '') || 'space';
  const day = date.toISOString().slice(0, 10);
  return `${safeSlug}-token-holders-${day}.csv`;
}
