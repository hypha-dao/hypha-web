import { CURRENCY_FEEDS } from './token-backing-vault';

/**
 * Currencies we can convert between: exactly those with an X/USD feed. Kept as
 * the keys of {@link CURRENCY_FEEDS} so a newly wired feed becomes convertible
 * without a second list to update.
 */
export type ConvertibleCurrency = keyof typeof CURRENCY_FEEDS;

export const CONVERTIBLE_CURRENCIES = Object.keys(
  CURRENCY_FEEDS,
) as ConvertibleCurrency[];

/** USD value of one unit of each convertible currency, e.g. `{ AUD: 0.65 }`. */
export type UsdRates = Partial<Record<ConvertibleCurrency, number>>;

/**
 * `reference_currency` is free text in the DB, so an `in` check would accept
 * inherited names like `constructor` and hand back a function as the rate,
 * turning the balance total into NaN. Only own keys count.
 */
export function isConvertibleCurrency(
  currency: string | null | undefined,
): currency is ConvertibleCurrency {
  return (
    currency != null &&
    Object.prototype.hasOwnProperty.call(CURRENCY_FEEDS, currency)
  );
}

/**
 * Convert `amount`, denominated in `currency`, into USD.
 *
 * An unknown or unavailable rate falls back to 1:1. That keeps a balance
 * visible rather than collapsing it to zero, at the cost of being off by the
 * FX spread — the per-token card still shows the true source currency, so the
 * fallback never mislabels what the number is denominated in.
 */
export function convertToUsd(
  amount: number,
  currency: string | null | undefined,
  rates: UsdRates,
): number {
  if (!amount || !Number.isFinite(amount)) return 0;
  if (!currency || currency === 'USD') return amount;
  const rate = isConvertibleCurrency(currency) ? rates[currency] : undefined;
  if (rate === undefined || rate <= 0) {
    console.warn(`No USD rate for ${currency}; treating it as 1:1`);
    return amount;
  }
  return amount * rate;
}

/** Convert a USD amount into `currency`. Mirrors {@link convertToUsd}. */
export function convertFromUsd(
  usdAmount: number,
  currency: string | null | undefined,
  rates: UsdRates,
): number {
  if (!usdAmount || !Number.isFinite(usdAmount)) return 0;
  if (!currency || currency === 'USD') return usdAmount;
  const rate = isConvertibleCurrency(currency) ? rates[currency] : undefined;
  if (rate === undefined || rate <= 0) return usdAmount;
  return usdAmount / rate;
}
