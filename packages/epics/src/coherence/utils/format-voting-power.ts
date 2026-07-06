import { formatUnits } from 'viem';

/**
 * Formats raw voting power units (wei-scale for token sources, whole votes
 * for 1m1v) into a compact human string, e.g. "12.4K".
 */
export function formatVotingPowerCompact(
  raw: string | undefined,
  tokenDecimals: number,
  locale?: string,
): string {
  let value = 0;
  try {
    value = Number(formatUnits(BigInt(raw ?? '0'), tokenDecimals));
  } catch {
    value = 0;
  }
  if (!Number.isFinite(value)) value = 0;
  return new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
