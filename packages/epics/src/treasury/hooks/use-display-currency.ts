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
    const rates: UsdRates = rate ? { [currency]: rate } : {};

    const formatFromUsd = (usdAmount: number): string => {
      const value = convertFromUsd(usdAmount, currency, rates);
      try {
        // Let Intl place the symbol and the sign: de-DE writes "1.234,56 €",
        // not "€ 1.234,56". Fraction digits still adapt to the magnitude.
        return formatCurrencyValue(value, locale, {
          style: 'currency',
          currency,
        });
      } catch {
        return `${currency} ${formatCurrencyValue(value, locale)}`;
      }
    };

    return { currency, formatFromUsd };
  }, [currency, locale, rate]);
};
