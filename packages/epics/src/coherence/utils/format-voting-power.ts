import { formatUnits } from 'viem';

/**
 * Formats raw voting power units (wei-scale for token sources, whole votes
 * for 1m1v). Small nets keep fractions such as 0.5 and 1.25 and drop trailing
 * zeros. Values from 1,000 up stay compact, e.g. "694.3K".
 */
export function formatVotingPowerCompact(
  raw: string | undefined,
  tokenDecimals: number,
  locale?: string,
): string {
  let value = 0;
  try {
    const units = BigInt(raw ?? '0');
    const negative = units < 0n;
    value = Number(formatUnits(negative ? -units : units, tokenDecimals));
    if (negative) value = -value;
  } catch {
    value = 0;
  }
  if (!Number.isFinite(value)) value = 0;
  const compact = Math.abs(value) >= 1000;
  return new Intl.NumberFormat(locale, {
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
    minimumFractionDigits: 0,
  }).format(value);
}

/**
 * The same units as the compact figure, grouped for the locale, without
 * compact rounding. Used as the cell's accessible name and tooltip.
 */
export function formatVotingPowerExact(
  raw: string | undefined,
  tokenDecimals: number,
  locale?: string,
): string {
  let units = '0';
  try {
    units = formatUnits(BigInt(raw ?? '0'), Math.max(0, tokenDecimals | 0));
  } catch {
    return '0';
  }
  const negative = units.startsWith('-');
  const unsigned = negative ? units.slice(1) : units;
  const [whole, frac = ''] = unsigned.split('.');
  let grouped = whole || '0';
  try {
    grouped = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      useGrouping: true,
    }).format(BigInt(grouped));
  } catch {
    // Keep the ungrouped integer if the runtime cannot format a bigint.
  }
  const trimmed = frac.replace(/0+$/, '');
  if (!trimmed) return negative ? `-${grouped}` : grouped;
  const separator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.1)
      .find((part) => part.type === 'decimal')?.value ?? '.';
  const body = `${grouped}${separator}${trimmed}`;
  return negative ? `-${body}` : body;
}
