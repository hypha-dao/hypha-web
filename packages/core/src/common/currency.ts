import {
  CURRENCY_FEED_OPTIONS,
  CURRENCY_FEEDS,
} from './web3/token-backing-vault';
import { TOKEN_PRICE_REFERENCE_CURRENCIES } from '../governance/types';

export type SupportedDisplayCurrency =
  (typeof TOKEN_PRICE_REFERENCE_CURRENCIES)[number];

export const CURRENCY_SYMBOL_BY_CODE: Record<SupportedDisplayCurrency, string> =
  {
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'C$',
    CHF: 'CHF ',
    AUD: 'A$',
  };

export const DISPLAY_CURRENCY_OPTIONS = TOKEN_PRICE_REFERENCE_CURRENCIES.map(
  (code) => ({
    value: code,
    label: code,
  }),
);

const FEED_ADDRESS_TO_CODE = Object.fromEntries(
  CURRENCY_FEED_OPTIONS.map((option) => [
    option.value.toLowerCase(),
    option.label,
  ]),
) as Record<string, SupportedDisplayCurrency>;

const SUPPORTED_DISPLAY_CURRENCY_SET = new Set<string>(
  TOKEN_PRICE_REFERENCE_CURRENCIES,
);

export function getCurrencySymbol(currencyCode?: string | null): string {
  const normalized = normalizeDisplayCurrencyCode(currencyCode);
  return CURRENCY_SYMBOL_BY_CODE[normalized];
}

export function normalizeDisplayCurrencyCode(
  currency?: string | null,
): SupportedDisplayCurrency {
  if (!currency || currency.trim() === '') {
    return 'USD';
  }

  const trimmed = currency.trim();
  const upper = trimmed.toUpperCase();
  if (SUPPORTED_DISPLAY_CURRENCY_SET.has(upper)) {
    return upper as SupportedDisplayCurrency;
  }

  const fromFeed = FEED_ADDRESS_TO_CODE[trimmed.toLowerCase()];
  if (fromFeed) {
    return fromFeed;
  }

  return 'USD';
}

export function convertUsdToDisplayCurrency(
  usdAmount: number,
  displayCurrency: SupportedDisplayCurrency,
  ratesToUsd: Record<string, number>,
): number {
  if (!Number.isFinite(usdAmount)) {
    return 0;
  }
  if (displayCurrency === 'USD') {
    return usdAmount;
  }

  const currencyToUsdRate = ratesToUsd[displayCurrency];
  if (
    typeof currencyToUsdRate !== 'number' ||
    !Number.isFinite(currencyToUsdRate) ||
    currencyToUsdRate <= 0
  ) {
    return usdAmount;
  }

  return usdAmount / currencyToUsdRate;
}

export function resolveReferenceCurrencyCode(
  referenceCurrency?: string | null,
): SupportedDisplayCurrency {
  return normalizeDisplayCurrencyCode(referenceCurrency);
}
