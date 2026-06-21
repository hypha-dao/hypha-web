import {
  convertUsdToDisplayCurrency,
  normalizeDisplayCurrencyCode,
  resolveReferenceCurrencyCode,
  type SupportedDisplayCurrency,
} from './currency';
import type { CurrencyRatesToUsd } from './currency-rates';

export function computeTokenPriceInUsd({
  marketPriceUsd,
  referencePrice,
  referenceCurrency,
  ratesToUsd,
}: {
  marketPriceUsd?: number;
  referencePrice?: number;
  referenceCurrency?: string | null;
  ratesToUsd: CurrencyRatesToUsd;
}): number {
  if (
    typeof marketPriceUsd === 'number' &&
    Number.isFinite(marketPriceUsd) &&
    marketPriceUsd > 0
  ) {
    return marketPriceUsd;
  }

  if (
    typeof referencePrice !== 'number' ||
    !Number.isFinite(referencePrice) ||
    referencePrice <= 0
  ) {
    return 0;
  }

  const currency = normalizeDisplayCurrencyCode(referenceCurrency);
  const currencyToUsdRate = ratesToUsd[currency as SupportedDisplayCurrency];
  if (
    typeof currencyToUsdRate !== 'number' ||
    !Number.isFinite(currencyToUsdRate) ||
    currencyToUsdRate <= 0
  ) {
    return referencePrice;
  }

  return referencePrice * currencyToUsdRate;
}

export type TreasuryAssetLike = {
  value: number;
  tokenPrice?: number;
  referenceCurrency?: string | null;
  usdEqual: number;
};

export function applyTreasuryAssetPricing<T extends TreasuryAssetLike>({
  asset,
  marketPriceUsd,
  referencePrice,
  referenceCurrency,
  ratesToUsd,
  displayCurrency,
}: {
  asset: T;
  marketPriceUsd?: number;
  referencePrice?: number;
  referenceCurrency?: string | null;
  ratesToUsd: CurrencyRatesToUsd;
  displayCurrency: SupportedDisplayCurrency;
}): T {
  const priceInUsd = computeTokenPriceInUsd({
    marketPriceUsd,
    referencePrice,
    referenceCurrency,
    ratesToUsd,
  });

  const usdEqual = priceInUsd * asset.value;
  const convertedEqual = convertUsdToDisplayCurrency(
    usdEqual,
    displayCurrency,
    ratesToUsd,
  );

  const resolvedReferenceCurrency = resolveReferenceCurrencyCode(
    referencePrice && referencePrice > 0 ? referenceCurrency : 'USD',
  );

  const tokenPriceForDisplay =
    typeof referencePrice === 'number' &&
    Number.isFinite(referencePrice) &&
    referencePrice > 0
      ? referencePrice
      : priceInUsd > 0
      ? convertUsdToDisplayCurrency(priceInUsd, displayCurrency, ratesToUsd)
      : 0;

  return {
    ...asset,
    tokenPrice: tokenPriceForDisplay,
    referenceCurrency:
      typeof referencePrice === 'number' &&
      Number.isFinite(referencePrice) &&
      referencePrice > 0
        ? resolvedReferenceCurrency
        : displayCurrency,
    usdEqual: convertedEqual,
  };
}

export function sumTreasuryBalance(assets: TreasuryAssetLike[]): number {
  return assets.reduce((sum, asset) => sum + asset.usdEqual, 0);
}

export function resolveTreasuryDisplayCurrency(
  requested?: string | null,
  fallback?: string | null,
): SupportedDisplayCurrency {
  return normalizeDisplayCurrencyCode(requested ?? fallback ?? 'USD');
}
