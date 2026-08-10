'use client';

import React from 'react';
import useSWR from 'swr';
import { useLocale } from 'next-intl';
import {
  useMe,
  convertFromUsd,
  isConvertibleCurrency,
  type UsdRates,
} from '@hypha-platform/core/client';
import { formatCurrencyValue } from '@hypha-platform/ui-utils';

const RATES_ENDPOINT = '/api/v1/currency-rates';

/**
 * Rates move slowly and every balance header on the page shares this key, so
 * one hourly revalidation covers the whole app.
 */
const RATES_REFRESH_INTERVAL = 60 * 60 * 1000;

const fetchRates = (endpoint: string): Promise<{ rates: UsdRates }> =>
  fetch(endpoint).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch currency rates`);
    return res.json();
  });

/**
 * Currency symbol as written in `locale`, e.g. `A$` for AUD in en-US. Falls
 * back to the ISO code so an unrecognized currency still renders sensibly.
 */
function getCurrencySymbol(currency: string, locale: string): string {
  try {
    return (
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency
    );
  } catch {
    return currency;
  }
}

/**
 * Renders USD-denominated totals in the currency the member picked on their
 * profile. Defaults to USD, which is what the API already sums in, so an
 * unset preference or an unavailable rate leaves the display unchanged.
 */
export const useDisplayCurrency = () => {
  const locale = useLocale();
  const { person } = useMe();
  const { data } = useSWR(RATES_ENDPOINT, fetchRates, {
    refreshInterval: RATES_REFRESH_INTERVAL,
    revalidateOnFocus: false,
  });

  const preferred = person?.preferredCurrency;
  const preferredRate =
    preferred && isConvertibleCurrency(preferred)
      ? data?.rates?.[preferred]
      : undefined;

  /**
   * Only switch away from USD once the rate is actually in hand — otherwise the
   * header would briefly show a USD figure under, say, an AUD symbol.
   */
  const currency =
    preferred && preferred !== 'USD' && preferredRate ? preferred : 'USD';
  const rate = currency === 'USD' ? 1 : preferredRate;

  return React.useMemo(() => {
    const symbol = getCurrencySymbol(currency, locale);
    const rates: UsdRates = rate ? { [currency]: rate } : {};

    const formatFromUsd = (usdAmount: number): string => {
      const value = convertFromUsd(usdAmount, currency, rates);
      const sign = value < 0 ? '-' : '';
      return `${sign}${symbol} ${formatCurrencyValue(Math.abs(value), locale)}`;
    };

    return { currency, formatFromUsd };
  }, [currency, locale, rate]);
};
