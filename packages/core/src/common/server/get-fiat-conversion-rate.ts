import 'server-only';
import NodeCache from 'node-cache';
import {
  DEFAULT_CURRENCY,
  SupportedCurrency,
  resolveSupportedCurrency,
  SUPPORTED_CURRENCIES,
} from '../currency';

const conversionCache = new NodeCache({ stdTTL: 300 });

type FiatConversionResponse = {
  usd?: Record<string, number>;
};

const getConversionCacheKey = (currency: SupportedCurrency) =>
  `usd_to_${currency}`;

const getSupportedQuoteCurrencies = (): string =>
  SUPPORTED_CURRENCIES.map((currency) => currency.toLowerCase()).join(',');

async function fetchUsdConversionRate(currency: SupportedCurrency) {
  if (currency === DEFAULT_CURRENCY) {
    return 1;
  }

  const cacheKey = getConversionCacheKey(currency);
  const cachedRate = conversionCache.get<number>(cacheKey);
  if (cachedRate !== undefined) {
    return cachedRate;
  }

  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=usd&vs_currencies=${getSupportedQuoteCurrencies()}`,
    {
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch fiat rates: ${response.statusText}`);
  }

  const data = (await response.json()) as FiatConversionResponse;
  const normalizedCurrency = currency.toLowerCase();
  const rate = data.usd?.[normalizedCurrency];

  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    throw new Error(`Invalid conversion rate for currency "${currency}"`);
  }

  conversionCache.set(cacheKey, rate);
  return rate;
}

export async function getUsdConversionRate(currency?: string | null) {
  const resolvedCurrency = resolveSupportedCurrency(currency);

  try {
    const rate = await fetchUsdConversionRate(resolvedCurrency);
    return { currency: resolvedCurrency, rate };
  } catch (error) {
    console.error('Failed to get fiat conversion rate:', error);
    return { currency: DEFAULT_CURRENCY, rate: 1 };
  }
}
