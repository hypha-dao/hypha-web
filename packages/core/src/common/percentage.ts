/** Basis points for 0–100% with two decimals (10000 = 100.00%). */
const MAX_BPS = 10000;

/**
 * Converts a percentage string in the format `0.00`-`100.00` to a bigint.
 * The string can have up to two decimal places.
 * `0.00` maps to 0n, `100.00` maps to 10000n.
 *
 * @param value - The percentage string (e.g., "12.34", "5", "100.00")
 * @returns The corresponding bigint (value * 100)
 * @throws {Error} If the string is not a valid percentage within 0‑100
 */
export function percentageStringToBigInt(value: string): bigint {
  const trimmed = value.trim();

  // Regex: integer part (one or more digits), optional decimal part with 1 or 2 digits
  // Does not allow leading zeros? They are allowed (e.g., "001.23").
  const regex = /^\d+(\.\d{1,2})?$/;
  if (!regex.test(trimmed)) {
    throw new Error(
      `Invalid percentage format: "${value}". Expected a number between 0 and 100 with up to two decimal places.`,
    );
  }

  const parts = trimmed.split('.');
  const intPartRaw = parts[0] ?? '';
  const fracPartRaw = parts[1] ?? '';
  const whole = BigInt(intPartRaw === '' ? '0' : intPartRaw);
  const paddedFrac = (fracPartRaw + '00').slice(0, 2);
  if (!/^\d{2}$/.test(paddedFrac)) {
    throw new Error(
      `Invalid percentage format: "${value}". Expected a number between 0 and 100 with up to two decimal places.`,
    );
  }
  const fracBps = BigInt(paddedFrac);
  const bps = whole * 100n + fracBps;
  if (bps < 0n || bps > BigInt(MAX_BPS)) {
    throw new Error(
      `Percentage out of range: "${value}". Must be between 0 and 100 inclusive.`,
    );
  }
  return bps;
}

/**
 * Converts a bigint back to a percentage string with two decimal places.
 * Inverse of `percentageStringToBigInt`.
 *
 * @param value - The bigint (e.g., 1234n for 12.34%)
 * @returns The formatted percentage string (e.g., "12.34")
 */
export function bigIntToPercentageString(value: bigint): string {
  const num = Number(value);
  const percentage = num / 100;
  // Ensure exactly two decimal places, strip trailing zeros? Keep two decimals.
  return percentage.toFixed(2);
}

/**
 * Returns the percentage string for the last row so that all rows sum to 100.00%,
 * using basis-point math to avoid float drift.
 */
export function remainderPercentStringForLastRow(
  otherRowPercentages: string[],
): string {
  let sumBps = 0n;
  for (const raw of otherRowPercentages) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      continue;
    }
    try {
      sumBps += percentageStringToBigInt(trimmed);
    } catch (err) {
      throw new Error(
        `Invalid percentage in remainder row inputs: "${trimmed}"`,
        { cause: err },
      );
    }
  }
  let rem = BigInt(MAX_BPS) - sumBps;
  if (rem < 0n) {
    rem = 0n;
  }
  if (rem > BigInt(MAX_BPS)) {
    rem = BigInt(MAX_BPS);
  }
  return bigIntToPercentageString(rem);
}
