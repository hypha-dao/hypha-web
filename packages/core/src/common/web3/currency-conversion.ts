import { CURRENCY_FEEDS } from './token-backing-vault';

/**
 * Fiat we convert via an off-chain FX source, not an AggregatorV3 feed.
 * Do not add these to {@link CURRENCY_FEEDS} — there is no on-chain oracle.
 */
export const OFFCHAIN_USD_CURRENCIES = ['TZS'] as const;
export type OffchainUsdCurrency = (typeof OFFCHAIN_USD_CURRENCIES)[number];

/**
 * Currencies we can convert between: on-chain X/USD feeds plus off-chain
 * display currencies (TZS). A newly wired feed still becomes convertible
 * automatically; off-chain codes are listed explicitly.
 */
export type ConvertibleCurrency =
  | keyof typeof CURRENCY_FEEDS
  | OffchainUsdCurrency;

const CONVERTIBLE_SET = new Set<string>([
  ...Object.keys(CURRENCY_FEEDS),
  ...OFFCHAIN_USD_CURRENCIES,
]);

export const CONVERTIBLE_CURRENCIES = [
  ...Object.keys(CURRENCY_FEEDS),
  ...OFFCHAIN_USD_CURRENCIES,
] as ConvertibleCurrency[];

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
  return currency != null && CONVERTIBLE_SET.has(currency);
}

/**
 * USD per 1 TZS from CoinGecko `/simple/price?ids=bitcoin&vs_currencies=usd,tzs`.
 * Both quotes are BTC-based, so the ratio cancels the vehicle asset.
 */
export function usdRateFromCoingeckoBtcQuotes(quotes: {
  usd?: number;
  tzs?: number;
}): number | undefined {
  const { usd, tzs } = quotes;
  if (
    usd == null ||
    tzs == null ||
    !Number.isFinite(usd) ||
    !Number.isFinite(tzs) ||
    usd <= 0 ||
    tzs <= 0
  ) {
    return undefined;
  }
  const rate = usd / tzs;
  if (!Number.isFinite(rate) || rate <= 0) return undefined;
  return rate;
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
