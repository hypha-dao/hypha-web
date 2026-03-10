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

  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0 || num > 100) {
    throw new Error(
      `Percentage out of range: "${value}". Must be between 0 and 100 inclusive.`,
    );
  }

  // Convert to integer representation with two decimal places
  // Multiply by 100 and round to avoid floating point errors
  const integer = Math.round(num * 100);
  return BigInt(integer);
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
  if (isNaN(num)) {
    throw new Error(`Invalid bigint: ${value}`);
  }
  const percentage = num / 100;
  // Ensure exactly two decimal places, strip trailing zeros? Keep two decimals.
  return percentage.toFixed(2);
}
