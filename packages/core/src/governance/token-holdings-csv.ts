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

function isOtherLabel(value: string): boolean {
  return value.trim().toLowerCase() === 'other';
}

/** Chart leftover bucket: kind/name Other and no wallet address. */
export function isAggregatedOtherHolding(
  holding: TokenHoldingsCsvHolding,
): boolean {
  return (
    !holding.address &&
    (isOtherLabel(holding.holder_kind) || isOtherLabel(holding.display_name))
  );
}

function csvHolderKind(holding: TokenHoldingsCsvHolding): string {
  return isOtherLabel(holding.holder_kind) ? '' : holding.holder_kind;
}

function csvDisplayName(holding: TokenHoldingsCsvHolding): string {
  return isOtherLabel(holding.display_name) ? '' : holding.display_name;
}

/**
 * Builds a UTF-8 CSV of the full holder list across all tokens.
 * Column names stay English so the file stays machine-readable across locales.
 * Aggregated "Other" chart buckets are omitted; unnamed wallets stay as rows.
 */
export function buildTokenHoldingsCsv(
  tokens: readonly TokenHoldingsCsvToken[],
): string {
  const lines = [TOKEN_HOLDINGS_CSV_COLUMNS.join(',')];

  for (const token of tokens) {
    for (const holding of token.holdings) {
      if (isAggregatedOtherHolding(holding)) continue;
      const row = [
        token.name,
        token.symbol,
        token.token_address,
        csvHolderKind(holding),
        csvDisplayName(holding),
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

function isSafeFilenameChar(char: string): boolean {
  const code = char.charCodeAt(0);
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    char === '.' ||
    char === '_' ||
    char === '-'
  );
}

/** Linear slug sanitizer — avoid quantified regex on caller-controlled input. */
function sanitizeFilenameSlug(spaceSlug: string): string {
  const chars: string[] = [];
  for (const char of spaceSlug) {
    if (char === '/' || char === '\\') {
      chars.push('-');
      continue;
    }
    chars.push(isSafeFilenameChar(char) ? char : '-');
  }

  let start = 0;
  let end = chars.length;
  while (start < end && (chars[start] === '.' || chars[start] === '-')) {
    start += 1;
  }
  while (end > start && chars[end - 1] === '-') {
    end -= 1;
  }

  const safeSlug = chars.slice(start, end).join('');
  return safeSlug || 'space';
}

export function tokenHoldingsCsvFilename(
  spaceSlug: string,
  date = new Date(),
): string {
  const day = date.toISOString().slice(0, 10);
  return `${sanitizeFilenameSlug(spaceSlug)}-token-holders-${day}.csv`;
}
